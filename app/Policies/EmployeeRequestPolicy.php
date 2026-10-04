<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Models\EmployeeRequest;
use App\Models\User;

/**
 * Pengajuan: the requester owns it; approvers (and delegates) see what they
 * decide; HR / Direksi / Super Admin (requests.view_all) see everything in the
 * company; managers see their people's requests (User::visibleTo).
 */
class EmployeeRequestPolicy
{
    public function __construct(private readonly ApprovalQueue $queue) {}

    public function viewAny(User $actor): bool
    {
        return $actor->isActive();
    }

    public function view(User $actor, EmployeeRequest $request): bool
    {
        if ($request->user_id === $actor->id) {
            return true;
        }

        if ($request->user->company_id !== $actor->company_id) {
            return false;
        }

        if ($actor->hasPermission(Permission::RequestsViewAll) || $this->decide($actor, $request)) {
            return true;
        }

        $involved = $request->approvals->contains(
            fn ($step): bool => $step->approver_id === $actor->id || $step->delegated_from_id === $actor->id,
        );

        return $involved || User::query()->visibleTo($actor)->whereKey($request->user_id)->exists();
    }

    public function create(User $actor): bool
    {
        return $actor->isActive();
    }

    /**
     * Edit content / submit again: drafts and requests sent back for revision.
     */
    public function update(User $actor, EmployeeRequest $request): bool
    {
        return $request->user_id === $actor->id && $request->status->isEditable();
    }

    public function cancel(User $actor, EmployeeRequest $request): bool
    {
        return $request->user_id === $actor->id && $request->status->isCancelable();
    }

    /**
     * Approve / reject / ask for revision at the active step. Never your own request.
     */
    public function decide(User $actor, EmployeeRequest $request): bool
    {
        $step = $request->waitingStep();

        if ($step === null) {
            return false;
        }

        $step->setRelation('request', $request);

        return $this->queue->canDecide($actor, $step);
    }

    public function viewAttachment(User $actor, EmployeeRequest $request): bool
    {
        return $this->view($actor, $request);
    }

    public function delete(User $actor, EmployeeRequest $request): bool
    {
        return false;
    }
}
