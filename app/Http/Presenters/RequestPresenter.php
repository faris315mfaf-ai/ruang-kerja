<?php

namespace App\Http\Presenters;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Data\PlannedStep;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\ColleagueAbsences;
use App\Models\Attachment;
use App\Models\EmployeeRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Arrays sent to the request & approval pages (types in resources/js/types/requests.ts).
 */
final class RequestPresenter
{
    public function __construct(
        private readonly BalanceLedger $ledger,
        private readonly ColleagueAbsences $colleagues,
    ) {}

    /**
     * @return array{id: string, name: string, avatar: string|null, position: string|null, division: string|null}
     */
    public static function person(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar' => $user->avatar_url,
            'position' => $user->relationLoaded('position') ? $user->position?->name : null,
            'division' => $user->relationLoaded('division') ? $user->division?->name : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function type(LeaveType $type): array
    {
        return [
            'id' => $type->id,
            'code' => $type->code,
            'name' => $type->name,
            'category' => $type->category->value,
            'category_label' => $type->category->label(),
            'description' => $type->description,
            'annual_quota_days' => $type->annual_quota_days,
            'requires_attachment_after_days' => $type->requires_attachment_after_days,
            'allow_half_day' => $type->allow_half_day,
            'max_backdate_days' => $type->max_backdate_days,
            'is_paid' => $type->is_paid,
        ];
    }

    /**
     * Row in "Pengajuan saya" / "Persetujuan".
     *
     * @return array<string, mixed>
     */
    public function item(EmployeeRequest $request): array
    {
        $steps = $request->currentSteps();
        $waiting = $request->waitingStep();
        $decisive = $steps->first(fn (RequestApproval $step): bool => in_array($step->status, [ApprovalStatus::Rejected, ApprovalStatus::RevisionRequested], true));
        $countable = $steps->filter(fn (RequestApproval $step): bool => $step->status !== ApprovalStatus::Skipped || $step->decided_at !== null);
        $position = $waiting === null ? null : $countable->values()->search(fn (RequestApproval $step): bool => $step->is($waiting));

        return [
            'id' => $request->id,
            'number' => $request->number,
            'status' => $request->status->value,
            'status_label' => $request->status->label(),
            'type' => self::type($request->leaveType),
            'user' => self::person($request->user),
            'start_at' => $request->start_at->toIso8601String(),
            'end_at' => $request->end_at->toIso8601String(),
            'days' => $request->days,
            'minutes' => $request->minutes,
            'payload' => self::publicPayload($request),
            'round' => $request->round,
            'step_position' => $position === false || $position === null ? null : $position + 1,
            'step_count' => $countable->count(),
            'waiting' => $waiting === null ? null : [
                'label' => $waiting->stepLabel(),
                'approver' => $waiting->approver === null ? null : self::person($waiting->approver),
                'since' => $waiting->activated_at?->toIso8601String(),
            ],
            'decision_note' => $decisive === null ? null : [
                'status' => $decisive->status->value,
                'note' => $decisive->note,
                'by' => $decisive->approver?->name,
                'at' => $decisive->decided_at?->toIso8601String(),
            ],
            'submitted_at' => $request->submitted_at?->toIso8601String(),
            'created_at' => $request->created_at?->toIso8601String(),
            'updated_at' => $request->updated_at?->toIso8601String(),
            'decided_at' => $request->decided_at?->toIso8601String(),
        ];
    }

    /**
     * Full detail with timeline, balance impact and colleagues (panel / detail screen).
     *
     * @return array<string, mixed>
     */
    public function detail(EmployeeRequest $request, User $viewer): array
    {
        $request->loadMissing(['attachments', 'approvals.approver', 'approvals.delegatedFrom', 'substitute', 'user.position', 'user.division', 'leaveType']);

        $colleagues = $request->leaveType->category->isAbsence() && $request->status !== RequestStatus::Canceled
            ? $this->colleagues->around($request->user, $request->start_at, $request->end_at, $request->id)
            : null;

        return [
            ...$this->item($request),
            'reason' => $request->reason,
            'substitute' => $request->substitute === null ? null : self::person($request->substitute),
            'attachments' => $request->attachments->map(fn (Attachment $attachment): array => [
                'id' => $attachment->id,
                'filename' => $attachment->filename,
                'mime_type' => $attachment->mime_type,
                'size_bytes' => $attachment->size_bytes ?? 0,
                'url' => route('requests.attachment', ['employeeRequest' => $request->id, 'attachment' => $attachment->id]),
            ])->values()->all(),
            'timeline' => $this->timeline($request),
            'balance' => $this->balanceImpact($request),
            'colleagues' => $colleagues === null || $colleagues['people'] === [] ? null : $colleagues,
            'can' => [
                'edit' => Gate::forUser($viewer)->allows('update', $request),
                'cancel' => Gate::forUser($viewer)->allows('cancel', $request),
                'decide' => Gate::forUser($viewer)->allows('decide', $request),
            ],
        ];
    }

    /**
     * Steps of the current round (+ decided steps of earlier rounds as history).
     *
     * @return list<array<string, mixed>>
     */
    public function timeline(EmployeeRequest $request): array
    {
        return array_values($request->approvals
            ->filter(fn (RequestApproval $step): bool => $step->round === $request->round || $step->status->isDecision())
            ->sortBy([['round', 'asc'], ['step_order', 'asc']])
            ->map(fn (RequestApproval $step): array => [
                'id' => $step->id,
                'round' => $step->round,
                'current_round' => $step->round === $request->round,
                'step_order' => $step->step_order,
                'label' => $step->stepLabel(),
                'approver_type' => $step->approver_type->value,
                'status' => $step->status->value,
                'status_label' => $step->status->label(),
                'approver' => $step->approver === null ? null : self::person($step->approver),
                'delegated_from' => $step->delegatedFrom === null ? null : self::person($step->delegatedFrom),
                'note' => $step->note,
                'activated_at' => $step->activated_at?->toIso8601String(),
                'decided_at' => $step->decided_at?->toIso8601String(),
            ])
            ->all());
    }

    /**
     * "12 → 9 hari setelah disetujui".
     *
     * @return array{year: int, before: float, after: float, summary: array<string, mixed>}|null
     */
    public function balanceImpact(EmployeeRequest $request): ?array
    {
        $balance = $this->ledger->peek($request->user, $request->leaveType, BalanceLedger::yearOf($request));

        if ($balance === null) {
            return null;
        }

        $days = (float) ($request->days ?? 0);
        $approved = $request->status === RequestStatus::Approved;
        $counts = in_array($request->status, [RequestStatus::Pending, RequestStatus::Approved, RequestStatus::Draft, RequestStatus::RevisionRequested], true);

        $before = $approved ? $balance->remaining() + $days : $balance->remaining();
        $after = $counts ? $before - $days : $before;

        return [
            'year' => $balance->year,
            'before' => round($before, 1),
            'after' => round($after, 1),
            'summary' => $balance->toSummary(),
        ];
    }

    /**
     * Planned steps (form preview / admin preview).
     *
     * @param  list<PlannedStep>  $steps
     * @return list<array<string, mixed>>
     */
    public static function plannedSteps(array $steps): array
    {
        return array_map(fn (PlannedStep $step): array => [
            'step_order' => $step->stepOrder,
            'approver_type' => $step->type->value,
            'label' => $step->type->value === 'role' ? (Role::tryFrom((string) $step->role)?->label() ?? (string) $step->role) : $step->type->label(),
            'role' => $step->role,
            'status' => $step->status->value,
            'approver' => $step->approver === null ? null : self::person($step->approver),
            'delegated_from' => $step->delegatedFrom === null ? null : self::person($step->delegatedFrom),
            'note' => $step->note,
        ], $steps);
    }

    /**
     * Balance card data (Pengajuan saya).
     *
     * @return array<string, mixed>|null
     */
    public static function balance(?LeaveBalance $balance): ?array
    {
        return $balance?->toSummary();
    }

    /**
     * Payload keys safe for the client (attachments are exposed separately).
     *
     * @return array<string, mixed>
     */
    private static function publicPayload(EmployeeRequest $request): array
    {
        return array_intersect_key($request->payload, array_flip(['half_day', 'mode', 'date', 'start_time', 'end_time', 'check_in', 'check_out', 'destination']));
    }
}
