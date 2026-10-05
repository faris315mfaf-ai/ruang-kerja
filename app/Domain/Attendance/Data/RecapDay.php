<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Models\AttendanceDay;

/**
 * One calendar cell of a monthly recap. `kind`: a status value, `off`
 * (no schedule), `holiday`, `upcoming` (scheduled, not counted yet), or
 * `none` (scheduled but nothing recorded).
 */
final readonly class RecapDay
{
    public function __construct(
        public string $date,
        public string $kind,
        public bool $isWorkday,
        public ?AttendanceDay $day = null,
        public ?string $holidayName = null,
    ) {}
}
