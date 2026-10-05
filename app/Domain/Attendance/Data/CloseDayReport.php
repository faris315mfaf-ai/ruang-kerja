<?php

namespace App\Domain\Attendance\Data;

/**
 * Counts of what attendance:close-day changed for one work date.
 */
final class CloseDayReport
{
    public int $absent = 0;

    public int $needsCorrection = 0;

    public int $holiday = 0;

    public int $removed = 0;

    public int $deferred = 0;

    public function __construct(public readonly string $workDate) {}

    public function changed(): int
    {
        return $this->absent + $this->needsCorrection + $this->holiday + $this->removed;
    }
}
