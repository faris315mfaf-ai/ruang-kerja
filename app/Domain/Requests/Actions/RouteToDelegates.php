<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalFlowResolver;
use App\Domain\Requests\Services\ApproverResolver;
use App\Domain\Requests\Services\RequestNotifier;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\ApprovalDelegation;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Keeps waiting personal steps with the right person once delegations change
 * (new steps are routed at activation already). Runs daily, right after a
 * delegation is saved and after one is ended:
 *
 * - the original approver (delegated_from_id, else approver_id) is kept for
 *   good — a further hop never overwrites it;
 * - an active delegation (followed along chains) moves the step to the delegate;
 * - without one (expired or deleted) the step returns to the original approver.
 *
 * Steps are processed in a fixed order (oldest first) so runs are deterministic.
 */
final class RouteToDelegates
{
    public function __construct(
        private readonly ApprovalFlowResolver $flows,
        private readonly ApproverResolver $approvers,
        private readonly RequestNotifier $notifier,
    ) {}

    /**
     * @return int steps moved
     */
    public function handle(?ApprovalDelegation $only = null): int
    {
        $today = OfficeTime::todayString();
        $moved = 0;
        $people = $only === null ? null : [$only->delegator_id, $only->delegate_id];

        $steps = RequestApproval::query()
            ->where('status', ApprovalStatus::Waiting->value)
            ->whereNotNull('approver_id')
            ->when($people !== null, fn (Builder $query) => $query->where(fn (Builder $who) => $who
                ->whereIn('approver_id', $people ?? [])
                ->orWhereIn('delegated_from_id', $people ?? [])))
            ->whereHas('request', fn (Builder $request) => $request
                ->where('status', RequestStatus::Pending->value)
                // Scheduled per company (CompanySchedule): only the current company's requests.
                ->when(CurrentCompany::id(), fn (Builder $mine, string $company) => $mine->whereIn('user_id', User::query()->select('id')->where('company_id', $company)))
                ->whereColumn('requests.round', 'request_approvals.round'))
            ->with(['request.user', 'request.leaveType', 'request.approvals'])
            ->orderBy('activated_at')
            ->orderBy('id')
            ->get();

        foreach ($steps as $step) {
            $original = User::query()->find($step->delegated_from_id ?? $step->approver_id);

            if ($original === null) {
                continue;
            }

            $target = $this->delegateFor($step, $original, $today);
            $approverId = $target->id ?? $original->id;
            $delegatedFromId = $target === null ? null : $original->id;

            if ($approverId === $step->approver_id && $delegatedFromId === $step->delegated_from_id) {
                continue;
            }

            DB::transaction(fn () => $step->fill([
                'approver_id' => $approverId,
                'delegated_from_id' => $delegatedFromId,
            ])->save());

            $step->setRelation('approver', $target ?? $original);
            $this->notifier->awaitingApproval($step->request, $step);
            $moved++;
        }

        return $moved;
    }

    /**
     * Delegate standing in for the original approver today, or null when the
     * flow disallows delegation or the delegate may not decide this request.
     */
    private function delegateFor(RequestApproval $step, User $original, string $today): ?User
    {
        $flow = $this->flows->definitionFor($step->request->leaveType)['flow'];

        if ($flow !== null && ! $flow->allow_delegation) {
            return null;
        }

        $delegate = $this->approvers->activeDelegate($original, $today);

        if ($delegate === null
            || $delegate->id === $step->request->user_id
            // A delegate who already approved this round cannot take another step.
            || in_array($delegate->id, $step->request->approverIdsOfRound(), true)) {
            return null;
        }

        return $delegate;
    }
}
