<?php

namespace App\Domain\Attendance\Data;

/**
 * HR manual correction: office-local "HH:MM" times on a work date, reason
 * mandatory. A check-out at or before the check-in falls on the next day
 * (overnight shift).
 */
final readonly class CorrectionData
{
    public function __construct(
        public string $workDate,
        public ?string $checkIn,
        public ?string $checkOut,
        public string $reason,
    ) {}
}
