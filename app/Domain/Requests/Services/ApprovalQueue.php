<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * What a user has to decide: waiting steps routed to them personally (incl. as
 * delegate) and waiting role steps of a role they hold — never their own requests.
 */
final class ApprovalQueue
{
    /**
     * @return Builder<RequestApproval>
     */
    public function waitingFor(User $actor): Builder
    {
        $roles = $actor->getRoleNames()->values()->all();

        return RequestApproval::query()
            ->where('status', ApprovalStatus::Waiting->value)
            ->where(function (Builder $mine) use ($actor, $roles): void {
                $mine->where('approver_id', $actor->id);

                if ($roles !== []) {
                    $mine->orWhere(fn (Builder $role) => $role
                        ->whereNull('approver_id')
                        ->where('approver_type', ApproverType::Role->value)
                        ->whereIn('approver_role', $roles));
                }
            })
            // Not when the actor already approved a step of this round.
            ->whereNotExists(fn (QueryBuilder $done) => $done->selectRaw('1')
                ->from('request_approvals as done')
                ->whereColumn('done.request_id', 'request_approvals.request_id')
                ->whereColumn('done.round', 'request_approvals.round')
                ->where('done.status', ApprovalStatus::Approved->value)
                ->where(fn (QueryBuilder $who) => $who
                    ->where('done.approver_id', $actor->id)
                    ->orWhere('done.delegated_from_id', $actor->id)))
            ->whereHas('request', fn (Builder $request) => $request
                ->where('status', RequestStatus::Pending->value)
                ->whereColumn('requests.round', 'request_approvals.round')
                ->where('user_id', '!=', $actor->id)
                ->whereHas('user', fn (Builder $user) => $user->where('company_id', $actor->company_id)));
    }

    public function count(User $actor): int
    {
        return $this->waitingFor($actor)->count();
    }

    /**
     * Steps this user decided (newest first) — "Sudah diputus".
     *
     * @return Builder<RequestApproval>
     */
    public function decidedBy(User $actor): Builder
    {
        return RequestApproval::query()
            ->where('approver_id', $actor->id)
            ->whereIn('status', [ApprovalStatus::Approved->value, ApprovalStatus::Rejected->value, ApprovalStatus::RevisionRequested->value])
            ->latest('decided_at');
    }

    public function canDecide(User $actor, RequestApproval $step): bool
    {
        $request = $step->loadMissing('request.user')->request;

        if ($step->status !== ApprovalStatus::Waiting
            || $request->status !== RequestStatus::Pending
            || $step->round !== $request->round
            || $request->user_id === $actor->id
            || ! $actor->isActive()
            || $request->user->company_id !== $actor->company_id) {
            return false;
        }

        // One person approves at most one step per round (incl. as delegate).
        if (in_array($actor->id, $request->approverIdsOfRound(), true)) {
            return false;
        }

        if ($step->approver_id !== null) {
            return $step->approver_id === $actor->id;
        }

        return $step->approver_type === ApproverType::Role
            && $step->approver_role !== null
            && $actor->hasRole($step->approver_role);
    }
}
