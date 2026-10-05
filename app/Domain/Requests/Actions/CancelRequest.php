<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\RequestNotifier;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cancellation by the requester before the final decision. A pending request
 * gives its reserved days back (pending_days).
 */
final class CancelRequest
{
    public function __construct(
        private readonly BalanceLedger $ledger,
        private readonly RequestNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, EmployeeRequest $request): EmployeeRequest
    {
        /** @var array{0: EmployeeRequest, 1: RequestApproval|null} $result */
        $result = DB::transaction(function () use ($actor, $request): array {
            $request = EmployeeRequest::query()
                ->lockForUpdate()
                ->with(['user', 'leaveType', 'approvals.approver'])
                ->findOrFail($request->id);

            if ($request->user_id !== $actor->id) {
                throw new AuthorizationException('Hanya pemohon yang bisa membatalkan pengajuan.');
            }

            if (! $request->status->isCancelable()) {
                throw ValidationException::withMessages(['status' => 'Pengajuan yang sudah diputus tidak bisa dibatalkan.']);
            }

            $previous = $request->status;
            $waiting = $request->waitingStep();

            if ($previous === RequestStatus::Pending) {
                $this->ledger->release($request);
            }

            StopFlow::skipRemaining($request, 'Dibatalkan oleh pemohon.');
            $request->forceFill(['status' => RequestStatus::Canceled, 'current_step' => null])->save();

            $this->audit->log('request.canceled', $request, ['status' => $previous->value], ['status' => RequestStatus::Canceled->value], $actor);

            return [$request, $waiting];
        });

        $this->notifier->canceled($result[0], $result[1]);

        return $result[0];
    }
}
