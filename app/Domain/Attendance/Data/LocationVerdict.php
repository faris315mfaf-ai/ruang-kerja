<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Enums\AttendanceMethod;

/**
 * Outcome of the geofence rules: how the event is recorded and the closest
 * location (null when the company has no active location at all).
 */
final readonly class LocationVerdict
{
    public function __construct(
        public AttendanceMethod $method,
        public ?GeofenceMatch $match,
    ) {}

    public function isRemote(): bool
    {
        return $this->method === AttendanceMethod::Wfh;
    }
}
