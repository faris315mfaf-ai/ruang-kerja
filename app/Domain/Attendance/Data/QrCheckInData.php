<?php

namespace App\Domain\Attendance\Data;

use Carbon\CarbonImmutable;

/**
 * Input of a QR kiosk check-in or check-out (docs/ARCHITECTURE.md §3.2): the
 * scanned payload plus the GPS position when the employee allowed it.
 */
final readonly class QrCheckInData
{
    public function __construct(
        public string $payload,
        public ?float $latitude = null,
        public ?float $longitude = null,
        public ?float $accuracyM = null,
        public ?CarbonImmutable $clientTime = null,
        public ?string $deviceFingerprint = null,
        public ?string $ipAddress = null,
        public ?string $userAgent = null,
    ) {}

    public function hasCoordinates(): bool
    {
        return $this->latitude !== null && $this->longitude !== null;
    }
}
