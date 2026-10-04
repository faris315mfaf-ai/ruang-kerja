<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Notifications\RequestApproved;
use App\Domain\Requests\Notifications\RequestAwaitingApproval;
use App\Domain\Requests\Notifications\RequestCanceled;
use App\Domain\Requests\Notifications\RequestRejected;
use App\Domain\Requests\Notifications\RequestRevisionRequested;
use App\Domain\Requests\Notifications\RequestStepApproved;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

/**
 * Notifies approvers and requester at every step (PRD M2). Called after the
 * state change is committed.
 */
final class RequestNotifier
{
    public function __construct(private readonly ApproverResolver $approvers) {}

    public function awaitingApproval(EmployeeRequest $request, RequestApproval $step): void
    {
        Notification::send($this->approversOf($request, $step), new RequestAwaitingApproval($request));
    }

    public function stepApproved(EmployeeRequest $request, RequestApproval $decided, RequestApproval $next): void
    {
        $request->user->notify(new RequestStepApproved($request, $decided, $next));
        $this->awaitingApproval($request, $next);
    }

    public function approved(EmployeeRequest $request): void
    {
        $request->user->notify(new RequestApproved($request));

        if ($request->substitute !== null && $request->substitute->isActive()) {
            $request->substitute->notify(new RequestApproved($request));
        }
    }

    public function rejected(EmployeeRequest $request, RequestApproval $step): void
    {
        $request->user->notify(new RequestRejected($request, $step));
    }

    public function revisionRequested(EmployeeRequest $request, RequestApproval $step): void
    {
        $request->user->notify(new RequestRevisionRequested($request, $step));
    }

    public function canceled(EmployeeRequest $request, ?RequestApproval $waitingStep): void
    {
        if ($waitingStep !== null) {
            Notification::send($this->approversOf($request, $waitingStep), new RequestCanceled($request));
        }
    }

    /**
     * The person of a personal step, or every holder of the role of a role step.
     *
     * @return Collection<int, User>
     */
    public function approversOf(EmployeeRequest $request, RequestApproval $step): Collection
    {
        if ($step->approver_id !== null) {
            $approver = $step->approver;

            return collect($approver === null ? [] : [$approver]);
        }

        if ($step->approver_type === ApproverType::Role && $step->approver_role !== null) {
            return $this->approvers->roleHolders($step->approver_role, $request->user)->get()->toBase();
        }

        return collect();
    }
}
