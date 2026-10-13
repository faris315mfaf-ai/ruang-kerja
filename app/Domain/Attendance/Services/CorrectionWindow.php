<?php

namespace App\Domain\Attendance\Services;

use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Whether (and until when) an employee may still ask for an attendance
 * correction for a date: the company's active, unlocked "Koreksi absensi"
 * request type (category `correction`, code KOR) and its `max_backdate_days`
 * ("Koreksi maksimal N hari ke belakang", RequestDurationCalculator). Only
 * answers the question — the form and the submit belong to the requests module
 * (POST /pengajuan).
 */
final class CorrectionWindow
{
    private function __construct(private readonly ?LeaveType $type) {}

    public static function forUser(User $user): self
    {
        /** @var LeaveType|null $type */
        $type = LeaveType::query()
            ->visibleTo($user)
            ->active()
            ->whereNull('locked_reason')
            ->where('category', RequestCategory::Correction->value)
            ->ordered()
            ->first();

        return new self($type !== null && $type->isEligible($user) ? $type : null);
    }

    public function available(): bool
    {
        return $this->type !== null;
    }

    public function type(): ?LeaveType
    {
        return $this->type;
    }

    public function maxBackdateDays(): ?int
    {
        return $this->type?->max_backdate_days;
    }

    /**
     * Today or earlier, within the back-date limit (null limit = unlimited).
     */
    public function allows(string $date, ?string $today = null): bool
    {
        if ($this->type === null) {
            return false;
        }

        $today ??= OfficeTime::todayString();

        if ($date > $today) {
            return false;
        }

        $deadline = $this->deadline($date);

        return $deadline === null || $deadline >= $today;
    }

    /**
     * Last office date on which a correction for `$date` can still be
     * submitted; null when the type has no limit (or there is no such type).
     */
    public function deadline(string $date): ?string
    {
        $max = $this->maxBackdateDays();

        if ($this->type === null || $max === null) {
            return null;
        }

        return CarbonImmutable::parse($date)->addDays($max)->toDateString();
    }

    /**
     * The employee's open or approved correction requests for the dates of a
     * month, newest per date: [date => {id, number, status, statusLabel}].
     *
     * @return array<string, array{id: string, number: string|null, status: string, statusLabel: string}>
     */
    public static function requestsByDate(User $user, string $firstDate, string $lastDate): array
    {
        $requests = EmployeeRequest::query()
            ->ownedBy($user)
            ->whereHas('leaveType', fn ($query) => $query->where('category', RequestCategory::Correction->value))
            ->whereIn('status', [RequestStatus::Pending->value, RequestStatus::RevisionRequested->value, RequestStatus::Approved->value])
            ->whereBetween('start_at', [OfficeTime::startOfDay($firstDate), OfficeTime::endOfDay($lastDate)])
            ->orderBy('created_at')
            ->get(['id', 'number', 'status', 'start_at', 'payload']);

        $byDate = [];

        foreach ($requests as $request) {
            $date = is_string($request->payload['date'] ?? null) ? $request->payload['date'] : OfficeTime::date($request->start_at);
            $byDate[$date] = [
                'id' => $request->id,
                'number' => $request->number,
                'status' => $request->status->value,
                'statusLabel' => $request->status->label(),
            ];
        }

        return $byDate;
    }
}
