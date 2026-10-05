<?php

namespace App\Domain\Attendance\Data;

/**
 * Parsed `ruangkerja://checkin?l={location}&w={window}&s={hmac}`.
 */
final readonly class QrPayload
{
    public function __construct(
        public string $locationId,
        public int $window,
        public string $signature,
    ) {}
}
