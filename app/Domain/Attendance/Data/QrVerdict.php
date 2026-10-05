<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\QrToken;

/**
 * Outcome of a valid kiosk scan: where the employee is (the kiosk location),
 * the displayed token, and the distance to it when GPS was shared.
 */
final readonly class QrVerdict
{
    /**
     * @param  list<LogFlag>  $flags
     */
    public function __construct(
        public LocationVerdict $location,
        public QrToken $token,
        public ?float $distanceM,
        public array $flags = [],
    ) {}
}
