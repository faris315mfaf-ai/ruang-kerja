<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\WorkMode;
use Carbon\CarbonImmutable;

/**
 * Resolved schedule of one employee for one work date. All instants are UTC;
 * `workDate` is the office-local calendar date (midnight, office timezone).
 *
 * On a holiday `shift` still holds the shift the weekly pattern would apply
 * (so closing the day can record "Libur"), but there are no scheduled times.
 */
final readonly class DaySchedule
{
    public function __construct(
        public CarbonImmutable $workDate,
        public ?Shift $shift,
        public ?CarbonImmutable $scheduledStart,
        public ?CarbonImmutable $scheduledEnd,
        public WorkMode $workMode,
        public ?Holiday $holiday = null,
        public bool $isOverride = false,
    ) {}

    /**
     * Expected to work: a shift applies and the day is not a holiday (an explicit
     * date override still wins over a holiday).
     */
    public function isWorkday(): bool
    {
        return $this->shift !== null && $this->scheduledStart !== null && $this->scheduledEnd !== null;
    }

    public function isHoliday(): bool
    {
        return $this->holiday !== null && ! $this->isWorkday();
    }

    public function workDateString(): string
    {
        return $this->workDate->toDateString();
    }

    /**
     * Earliest check-in moment (start − window), null when unscheduled.
     */
    public function checkInOpensAt(): ?CarbonImmutable
    {
        if ($this->shift === null || $this->scheduledStart === null) {
            return null;
        }

        return $this->scheduledStart->subMinutes($this->shift->check_in_window_before_min);
    }

    /**
     * Last on-time moment (start + late tolerance).
     */
    public function lateThreshold(): ?CarbonImmutable
    {
        if ($this->shift === null || $this->scheduledStart === null) {
            return null;
        }

        return $this->scheduledStart->addMinutes($this->shift->late_tolerance_min);
    }

    /**
     * Earliest check-out that is not "pulang cepat" (end − tolerance).
     */
    public function earlyLeaveThreshold(): ?CarbonImmutable
    {
        if ($this->shift === null || $this->scheduledEnd === null) {
            return null;
        }

        return $this->scheduledEnd->subMinutes($this->shift->early_leave_tolerance_min);
    }

    /**
     * Whether a check-in may be accepted outside every geofence (method wfh).
     */
    public function allowsRemoteCheckIn(): bool
    {
        return in_array($this->workMode, [WorkMode::Wfh, WorkMode::Field], true);
    }
}
