<?php

namespace App\Domain\Requests\Data;

/**
 * What AttendanceEffects::revert() would change for a request (shown to HR
 * before an approved request is canceled, and used by the action itself).
 */
final readonly class AttendanceRevertPlan
{
    /**
     * @param  list<string>  $removedDates  absence rows without a check-in that are deleted (office dates, Y-m-d)
     * @param  list<string>  $unlinkedDates  absence rows the employee worked on anyway: kept, unlinked from the request
     * @param  string|null  $overtimeDate  work date whose overtime_minutes is recalculated
     * @param  string|null  $correctionDate  date of an applied correction whose original times are restored
     * @param  string|null  $blocker  why revert() refuses (e.g. the corrected day changed since)
     */
    public function __construct(
        public array $removedDates = [],
        public array $unlinkedDates = [],
        public ?string $overtimeDate = null,
        public ?string $correctionDate = null,
        public ?string $blocker = null,
    ) {}

    public function isBlocked(): bool
    {
        return $this->blocker !== null;
    }

    /**
     * @return array{removed_dates: list<string>, unlinked_dates: list<string>, overtime_date: string|null, correction_date: string|null, blocker: string|null}
     */
    public function toArray(): array
    {
        return [
            'removed_dates' => $this->removedDates,
            'unlinked_dates' => $this->unlinkedDates,
            'overtime_date' => $this->overtimeDate,
            'correction_date' => $this->correctionDate,
            'blocker' => $this->blocker,
        ];
    }
}
