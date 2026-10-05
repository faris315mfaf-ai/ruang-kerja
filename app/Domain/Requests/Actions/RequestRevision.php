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
 * "Minta revisi" (note required): the request goes back to the requester, who
 * edits and submits it again (a new round). The balance reservation is released
 * meanwhile so the edited period can be reserved anew.
 */
final class RequestRevision
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
            throw ValidationException::withMessages(['note' => 'Catatan wajib diisi saat meminta revisi.']);
        }

        /** @var array{0: EmployeeRequest, 1: RequestApproval} $result */
        $result = DB::transaction(function () use ($actor, $request, $note): array {
            [$request, $step] = $this->guard->lock($actor, $request);

            $step->fill([
                'status' => ApprovalStatus::RevisionRequested,
                'approver_id' => $actor->id,
                'note' => $note,
                'decided_at' => now(),
            ])->save();
            $step->setRelation('approver', $actor);

            StopFlow::skipRemaining($request, 'Menunggu revisi dari pemohon.');

            $request->forceFill(['status' => RequestStatus::RevisionRequested, 'current_step' => null])->save();
            $this->ledger->release($request);

            $this->audit->log('request.revision_requested', $request, ['status' => RequestStatus::Pending->value], [
                'status' => RequestStatus::RevisionRequested->value,
                'step' => $step->step_order,
                'note' => $note,
            ], $actor);

            return [$request, $step];
        });

        $this->notifier->revisionRequested($result[0], $result[1]);

        return $result[0];
    }
}
