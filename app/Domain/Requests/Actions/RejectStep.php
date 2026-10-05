<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\DecisionGuard;
use App\Domain\Requests\Services\RequestNotifier;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Rejects the request at the active step (reason required). The flow stops:
 * later steps are skipped and the reserved balance is released.
 */
final class RejectStep
{
    public function __construct(
        private readonly DecisionGuard $guard,
        private readonly BalanceLedger $ledger,
        private readonly RequestNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, EmployeeRequest $request, string $note): EmployeeRequest
    {
        $note = trim($note);

        if ($note === '') {
            throw ValidationException::withMessages(['note' => 'Alasan wajib diisi saat menolak.']);
        }

        /** @var array{0: EmployeeRequest, 1: RequestApproval} $result */
        $result = DB::transaction(function () use ($actor, $request, $note): array {
            [$request, $step] = $this->guard->lock($actor, $request);

            $step->fill([
                'status' => ApprovalStatus::Rejected,
                'approver_id' => $actor->id,
                'note' => $note,
                'decided_at' => now(),
            ])->save();
            $step->setRelation('approver', $actor);

            StopFlow::skipRemaining($request, 'Alur dihentikan karena pengajuan ditolak.');

            $request->forceFill(['status' => RequestStatus::Rejected, 'decided_at' => now(), 'current_step' => null])->save();
            $this->ledger->release($request);

            $this->audit->log('request.rejected', $request, ['status' => RequestStatus::Pending->value], [
                'status' => RequestStatus::Rejected->value,
                'step' => $step->step_order,
                // Privacy: ids + a flag only; the note itself lives on the step (in-app).
                'step_id' => $step->id,
                'has_note' => true,
            ], $actor);

            return [$request, $step];
        });

        $this->notifier->rejected($result[0], $result[1]);

        return $result[0];
    }
}
