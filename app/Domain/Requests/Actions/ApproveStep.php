<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalFlowResolver;
use App\Domain\Requests\Services\ApprovedRequestEffects;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\DecisionGuard;
use App\Domain\Requests\Services\RequestNotifier;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Approves the active step. The next step is activated; after the last one the
 * request is approved: balance pending → used and attendance effects applied.
 */
final class ApproveStep
{
    public function __construct(
        private readonly DecisionGuard $guard,
        private readonly ApprovalFlowResolver $flows,
        private readonly BalanceLedger $ledger,
        private readonly ApprovedRequestEffects $effects,
        private readonly RequestNotifier $notifier,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, EmployeeRequest $request, ?string $note = null): EmployeeRequest
    {
        /** @var array{0: EmployeeRequest, 1: RequestApproval, 2: RequestApproval|null} $result */
        $result = DB::transaction(function () use ($actor, $request, $note): array {
            [$request, $step] = $this->guard->lock($actor, $request);

            $step->fill([
                'status' => ApprovalStatus::Approved,
                'approver_id' => $actor->id,
                'note' => self::clean($note) ?? $step->note,
                'decided_at' => now(),
            ])->save();
            $step->setRelation('approver', $actor);

            $next = $this->flows->advance($request);

            $this->audit->log('request.step_approved', $request, ['step' => $step->step_order, 'status' => ApprovalStatus::Waiting->value], [
                'step' => $step->step_order,
                'status' => ApprovalStatus::Approved->value,
                'note' => $step->note,
            ], $actor);

            if ($next === null) {
                $request->forceFill(['status' => RequestStatus::Approved, 'decided_at' => now()])->save();
                $this->ledger->consume($request);
                $this->effects->apply($request);
                $this->audit->log('request.approved', $request, ['status' => RequestStatus::Pending->value], ['status' => RequestStatus::Approved->value], $actor);
            }

            return [$request, $step, $next];
        });

        [$request, $step, $next] = $result;

        if ($next === null) {
            $this->notifier->approved($request);
        } else {
            $this->notifier->stepApproved($request, $step, $next);
        }

        return $request;
    }

    private static function clean(?string $note): ?string
    {
        $note = $note === null ? null : trim($note);

        return $note === '' ? null : $note;
    }
}
