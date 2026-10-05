<?php

namespace App\Domain\Requests\Data;

use Carbon\CarbonImmutable;

/**
 * Computed period of a request: what is stored in requests.start_at/end_at/days/minutes.
 */
final readonly class RequestPeriod
{
    /**
     * @param  array<string, mixed>  $payload  category-specific payload keys
     * @param  list<string>  $workDates  office working dates covered (whole-day requests)
     */
    public function __construct(
        public CarbonImmutable $startAt,
        public CarbonImmutable $endAt,
        public ?float $days,
        public ?int $minutes,
        public array $payload,
        public array $workDates,
    ) {}
}
