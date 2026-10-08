<?php

namespace App\Domain\Attendance\Data;

use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;

/**
 * Input of a GPS + selfie check-in or check-out (docs/ARCHITECTURE.md §3.1).
 */
final readonly class CheckInData
{
    public function __construct(
        public float $latitude,
        public float $longitude,
        public ?float $accuracyM,
        public ?CarbonImmutable $clientTime,
        public UploadedFile $selfie,
        public ?string $deviceFingerprint = null,
        public ?string $ipAddress = null,
        public ?string $userAgent = null,
        public ?string $note = null,
        public ?string $workPlan = null,
    ) {}
}
