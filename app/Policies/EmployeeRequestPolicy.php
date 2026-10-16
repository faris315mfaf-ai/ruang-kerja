<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Requests\Actions\CancelApprovedRequest;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ApprovalQueue;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
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

        $request->loadMissing(['user', 'approvals']);

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
     * HR / Super Admin (requests.cancel_approved) void an approved request of
     * someone else in their company (CancelApprovedRequest).
     */
    public function cancelApproved(User $actor, EmployeeRequest $request): bool
    {
        return $request->status === RequestStatus::Approved && CancelApprovedRequest::allowedFor($actor, $request);
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

        $step->setRelation('request', $request->loadMissing('user'));

        return $this->queue->canDecide($actor, $step);
    }

    /**
     * Attachments of a sick request are health data: same rule as the reason
     * (see viewHealthDetails); other attachments follow `view`.
     */
    public function viewAttachment(User $actor, EmployeeRequest $request): bool
    {
        return $this->viewHealthDetails($actor, $request);
    }

    /**
     * Reason (diagnosis) and attachments of a sick request (Fitur pengajuan #5):
     * the requester, HR / Direksi / Super Admin (requests.view_all), original
     * approvers (incl. a delegator, a role step's holder) and the requester's
     * line management keep them. Someone who sees the request only because a
     * step was delegated to them (substitute approver) gets dates, duration and
     * status only. Non-sick requests: same as `view`.
     */
    public function viewHealthDetails(User $actor, EmployeeRequest $request): bool
    {
        if (! $this->view($actor, $request)) {
            return false;
        }

        $request->loadMissing(['leaveType', 'approvals']);

        if ($request->leaveType->category !== RequestCategory::Sick
            || $request->user_id === $actor->id
            || $actor->hasPermission(Permission::RequestsViewAll)) {
            return true;
        }

        $original = $request->approvals->contains(fn (RequestApproval $step): bool => $step->delegated_from_id === $actor->id
            || ($step->approver_id === $actor->id && $step->delegated_from_id === null)
            // Waiting role step: every holder of the role is an original approver.
            || ($step->approver_id === null && $step->approver_type === ApproverType::Role && $step->approver_role !== null
                && $step->status === ApprovalStatus::Waiting && $actor->hasRole($step->approver_role)));

        return $original || User::query()->visibleTo($actor)->whereKey($request->user_id)->exists();
    }

    /**
     * Throwing away an own draft that was never sent (no number, no flow, no
     * balance): the mobile app's "Hapus draf" (DeleteRequestDraft). Anything
     * sent once stays as history and can only be canceled.
     */
    public function delete(User $actor, EmployeeRequest $request): bool
    {
        return $request->user_id === $actor->id && $request->status === RequestStatus::Draft;
    }
}
