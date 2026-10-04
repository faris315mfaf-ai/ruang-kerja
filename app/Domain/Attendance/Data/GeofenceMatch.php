<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Models\OfficeLocation;

final readonly class GeofenceMatch
{
    public function __construct(
        public OfficeLocation $location,
        public float $distanceM,
        public bool $inside,
    ) {}

    /**
     * Rounded distance for messages and storage.
     */
    public function roundedDistance(): int
    {
        return (int) round($this->distanceM);
    }
}
