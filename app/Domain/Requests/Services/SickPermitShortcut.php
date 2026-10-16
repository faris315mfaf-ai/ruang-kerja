<?php

namespace App\Domain\Requests\Services;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Requests\Contracts\WorkingDayCalculator;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * "Tidak masuk? Ajukan sakit / izin" on the Absen screen (keputusan pemilik
 * 14 Okt 2026). State for every client (`leaveShortcut` of the attendance
 * payloads); the server clock decides, clients only render it.
 *
 * available = today is a working date, the employee has not checked in, has no
 * approved full-day absence, no sick/izin request waiting for a decision for
 * today, and at least one of the two types can still be sent before its cutoff.
 * When both cutoffs have passed the reason says so; a waiting request is
 * reported in `pending` (and then no cutoff reason, the status line says it all).
 */
final class SickPermitShortcut
{
    public function __construct(
        private readonly SubmissionCutoff $cutoff,
        private readonly WorkingDayCalculator $calendar,
    ) {}

    /**
     * @return array{
     *     available: bool,
     *     sickCutoff: string|null,
     *     permitCutoff: string|null,
     *     sickClosed: bool,
     *     permitClosed: bool,
     *     sickType: array{id: string, code: string, name: string}|null,
     *     permitType: array{id: string, code: string, name: string}|null,
     *     closedReason: string|null,
     *     pending: array{id: string, number: string|null, typeLabel: string, status: string, statusLabel: string}|null
     * }
     */
    public function handle(User $user, CarbonImmutable $now): array
    {
        $today = OfficeTime::local($now)->toDateString();
        $sick = $this->openType($user, RequestCategory::Sick);
        $permit = $this->openType($user, RequestCategory::Permit);
        $sickClosed = $sick !== null && $this->cutoff->closedToday($sick, $now);
        $permitClosed = $permit !== null && $this->cutoff->closedToday($permit, $now);
        $pending = $this->pending($user, $today);

        $blocked = $this->checkedIn($user, $today)
            || $this->approvedAbsence($user, $today)
            || $this->calendar->workingDates($user, OfficeTime::local($now)->startOfDay(), OfficeTime::local($now)->startOfDay()) === [];
        $anyType = $sick !== null || $permit !== null;
        $anyOpen = ($sick !== null && ! $sickClosed) || ($permit !== null && ! $permitClosed);

        return [
            'available' => ! $blocked && $pending === null && $anyType && $anyOpen,
            'sickCutoff' => $sick === null ? null : $this->cutoff->time($sick),
            'permitCutoff' => $permit === null ? null : $this->cutoff->time($permit),
            'sickClosed' => $sickClosed,
            'permitClosed' => $permitClosed,
            'sickType' => $sick === null ? null : ['id' => $sick->id, 'code' => $sick->code, 'name' => $sick->name],
            'permitType' => $permit === null ? null : ['id' => $permit->id, 'code' => $permit->code, 'name' => $permit->name],
            'closedReason' => ! $blocked && $pending === null && $anyType && ! $anyOpen ? $this->closedReason($sick, $permit) : null,
            'pending' => $pending === null ? null : [
                'id' => $pending->id,
                'number' => $pending->number,
                'typeLabel' => $pending->leaveType->name,
                'status' => $pending->status->value,
                'statusLabel' => $pending->status->label(),
            ],
        ];
    }

    /**
     * No sick/izin type to offer (or nobody to ask): the neutral state.
     *
     * @return array<string, mixed>
     */
    public static function unavailable(): array
    {
        return [
            'available' => false,
            'sickCutoff' => null,
            'permitCutoff' => null,
            'sickClosed' => false,
            'permitClosed' => false,
            'sickType' => null,
            'permitType' => null,
            'closedReason' => null,
            'pending' => null,
        ];
    }

    private function closedReason(?LeaveType $sick, ?LeaveType $permit): string
    {
        $sickTime = $sick === null ? null : $this->cutoff->time($sick);
        $permitTime = $permit === null ? null : $this->cutoff->time($permit);

        if ($sickTime !== null && $permitTime !== null && $sickTime !== $permitTime) {
            return sprintf('Batas pengajuan sakit pukul %s dan izin pukul %s sudah lewat.', SubmissionCutoff::format($sickTime), SubmissionCutoff::format($permitTime));
        }

        $time = SubmissionCutoff::format($sickTime ?? $permitTime ?? '');

        return match (true) {
            $sick !== null && $permit !== null => "Batas pengajuan sakit/izin pukul {$time} sudah lewat.",
            $sick !== null => "Batas pengajuan sakit pukul {$time} sudah lewat.",
            default => "Batas pengajuan izin pukul {$time} sudah lewat.",
        };
    }

    /**
     * The type a shortcut would open: the first active, unlocked, eligible type of the category.
     */
    private function openType(User $user, RequestCategory $category): ?LeaveType
    {
        return LeaveType::query()
            ->visibleTo($user)
            ->active()
            ->whereNull('locked_reason')
            ->where('category', $category->value)
            ->ordered()
            ->get()
            ->first(fn (LeaveType $type): bool => $type->isEligible($user));
    }

    private function checkedIn(User $user, string $today): bool
    {
        return AttendanceDay::query()
            ->where('user_id', $user->id)
            ->whereDate('work_date', $today)
            ->whereNotNull('check_in_at')
            ->exists();
    }

    /**
     * An approved request that already covers today as a whole day off.
     */
    private function approvedAbsence(User $user, string $today): bool
    {
        return $this->todaysRequests($user, $today, [RequestStatus::Approved], [RequestCategory::Leave, RequestCategory::Permit, RequestCategory::Sick])
            ->contains(fn (EmployeeRequest $request): bool => ! (bool) ($request->payload['half_day'] ?? false) && ($request->payload['mode'] ?? 'days') !== 'hours');
    }

    private function pending(User $user, string $today): ?EmployeeRequest
    {
        return $this->todaysRequests($user, $today, [RequestStatus::Pending, RequestStatus::RevisionRequested], [RequestCategory::Sick, RequestCategory::Permit])->first();
    }

    /**
     * @param  list<RequestStatus>  $statuses
     * @param  list<RequestCategory>  $categories
     * @return Collection<int, EmployeeRequest>
     */
    private function todaysRequests(User $user, string $today, array $statuses, array $categories): Collection
    {
        return EmployeeRequest::query()
            ->ownedBy($user)
            ->whereIn('status', RequestStatus::values($statuses))
            ->where('start_at', '<=', OfficeTime::endOfDay($today))
            ->where('end_at', '>=', OfficeTime::startOfDay($today))
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn('category', array_map(fn (RequestCategory $category): string => $category->value, $categories)))
            ->with('leaveType')
            ->orderBy('start_at')
            ->get();
    }
}
