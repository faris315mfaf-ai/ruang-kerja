<?php

namespace App\Domain\Attendance\Data;

use Carbon\CarbonImmutable;

/**
 * The QR code a kiosk shows for one window.
 */
final readonly class QrCode
{
    public function __construct(
        public string $payload,
        public int $window,
        public CarbonImmutable $validFrom,
        public CarbonImmutable $validUntil,
    ) {}
}
