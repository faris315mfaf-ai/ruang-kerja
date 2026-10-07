<?php

namespace App\Domain\Requests\Services;

use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Notifications\RequestApproved;
use App\Domain\Requests\Notifications\RequestAwaitingApproval;
use App\Domain\Requests\Notifications\RequestCanceled;
use App\Domain\Requests\Notifications\RequestCanceledAfterApproval;
use App\Domain\Requests\Notifications\RequestRejected;
use App\Domain\Requests\Notifications\RequestRevisionRequested;
use App\Domain\Requests\Notifications\RequestStepApproved;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

/**
 * Notifies approvers and requester at every step (PRD M2) and keeps the Inbox
 * "Perlu tindakan" list in sync (Sprint 8). Called after the state change.
 */
final class RequestNotifier
{
    public function __construct(
        private readonly ApproverResolver $approvers,
        private readonly ResolveNotificationsForSubject $resolve,
    ) {}

    /**
     * A step became active (submit, resubmit, previous step approved, delegation).
     */
    public function awaitingApproval(EmployeeRequest $request, RequestApproval $step): void
    {
        self::prepare($request, $step);
        $this->resolve->handle($request, NotificationType::RequestSubmitted, NotificationType::RequestRevisionRequested);
        Notification::send($this->approversOf($request, $step), new RequestAwaitingApproval($request));
    }

    public function stepApproved(EmployeeRequest $request, RequestApproval $decided, RequestApproval $next): void
    {
        self::prepare($request, $decided, $next);
        $request->user->notify(new RequestStepApproved($request, $decided, $next));
        $this->awaitingApproval($request, $next);
    }

    public function approved(EmployeeRequest $request, ?User $decidedBy = null): void
    {
        self::prepare($request);
        $this->resolve->handle($request, NotificationType::RequestSubmitted);
        $request->user->notify(new RequestApproved($request, $decidedBy));

        if ($request->substitute !== null && $request->substitute->isActive()) {
            $request->substitute->notify(new RequestApproved($request, $decidedBy));
        }
    }

    public function rejected(EmployeeRequest $request, RequestApproval $step): void
    {
        self::prepare($request, $step);
        $this->resolve->handle($request, NotificationType::RequestSubmitted);
        $request->user->notify(new RequestRejected($request, $step));
    }

    public function revisionRequested(EmployeeRequest $request, RequestApproval $step): void
    {
        self::prepare($request, $step);
        $this->resolve->handle($request, NotificationType::RequestSubmitted);
        $request->user->notify(new RequestRevisionRequested($request, $step));
    }

    public function canceled(EmployeeRequest $request, ?RequestApproval $waitingStep): void
    {
        self::prepare($request, ...array_filter([$waitingStep]));
        $this->resolve->handle($request, NotificationType::RequestSubmitted, NotificationType::RequestRevisionRequested);

        if ($waitingStep !== null) {
            Notification::send($this->approversOf($request, $waitingStep), new RequestCanceled($request));
        }
    }

    /**
     * HR voided an approved request: the requester, everyone who approved a
     * step (and the delegator it was approved for) and the substitute are told.
     */
    public function canceledAfterApproval(EmployeeRequest $request, User $canceledBy): void
    {
        self::prepare($request);
        $request->loadMissing('approvals.approver', 'approvals.delegatedFrom');

        if ($request->user->isActive()) {
            $request->user->notify(new RequestCanceledAfterApproval($request, $canceledBy, toRequester: true));
        }

        $others = $request->approvals
            ->filter(fn (RequestApproval $step): bool => $step->status === ApprovalStatus::Approved)
            ->flatMap(fn (RequestApproval $step): array => array_filter([$step->approver, $step->delegatedFrom]))
            ->merge(array_filter([$request->substitute]))
            ->filter(fn (User $user): bool => $user->isActive()
                && $user->id !== $canceledBy->id
                && $user->id !== $request->user_id)
            ->unique('id')
            ->values();

        if ($others->isNotEmpty()) {
            Notification::send($others, new RequestCanceledAfterApproval($request, $canceledBy, toRequester: false));
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
            $approver = $step->loadMissing('approver')->approver;

            return collect($approver === null ? [] : [$approver]);
        }

        if ($step->approver_type === ApproverType::Role && $step->approver_role !== null) {
            return $this->approvers->roleHolders($step->approver_role, $request->user)->get()->toBase();
        }

        return collect();
    }

    /**
     * Eager-loads what the notifications render (no lazy loading in strict mode).
     */
    private static function prepare(EmployeeRequest $request, RequestApproval ...$steps): void
    {
        $request->loadMissing(['user', 'leaveType', 'substitute']);

        foreach ($steps as $step) {
            $step->loadMissing('approver');
        }
    }
}
