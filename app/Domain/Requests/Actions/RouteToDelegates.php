<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalFlowResolver;
use App\Domain\Requests\Services\RequestNotifier;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\ApprovalDelegation;
use App\Models\RequestApproval;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Moves steps already waiting on an approver to their delegate once a
 * delegation is active (new steps are routed at activation already). Runs
 * daily and right after a delegation is saved.
 */
final class RouteToDelegates
{
    public function __construct(
        private readonly ApprovalFlowResolver $flows,
        private readonly RequestNotifier $notifier,
    ) {}

    public function handle(?ApprovalDelegation $only = null): int
    {
        $today = OfficeTime::todayString();
        $moved = 0;

        $delegations = ApprovalDelegation::query()
            ->activeOn($today)
            ->when($only !== null, fn (Builder $query) => $query->whereKey($only?->id))
            ->with('delegate')
            ->get();

        foreach ($delegations as $delegation) {
            if (! $delegation->delegate->isActive()) {
                continue;
            }

            $steps = RequestApproval::query()
                ->where('approver_id', $delegation->delegator_id)
                ->where('status', ApprovalStatus::Waiting->value)
                ->whereHas('request', fn (Builder $request) => $request
                    ->where('status', RequestStatus::Pending->value)
                    ->where('user_id', '!=', $delegation->delegate_id))
                ->with(['request.user', 'request.leaveType', 'request.approvals'])
                ->get();

            foreach ($steps as $step) {
                $flow = $this->flows->definitionFor($step->request->leaveType)['flow'];

                if ($flow !== null && ! $flow->allow_delegation) {
                    continue;
                }

                // A delegate who already approved this round cannot take another step.
                if (in_array($delegation->delegate_id, $step->request->approverIdsOfRound(), true)) {
                    continue;
                }

                DB::transaction(fn () => $step->fill([
                    'approver_id' => $delegation->delegate_id,
                    'delegated_from_id' => $delegation->delegator_id,
                ])->save());

                $step->setRelation('approver', $delegation->delegate);
                $this->notifier->awaitingApproval($step->request, $step);
                $moved++;
            }
        }

        return $moved;
    }
}
