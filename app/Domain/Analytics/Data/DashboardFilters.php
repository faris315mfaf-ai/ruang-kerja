<?php

namespace App\Domain\Analytics\Data;

use App\Models\Division;
use App\Models\Team;

/**
 * Normalized dashboard filter (period, division, team), mirrored in the URL
 * query: `?periode=kustom&dari=2026-09-01&sampai=2026-09-30&divisi=…&tim=…`.
 */
final readonly class DashboardFilters
{
    public function __construct(
        public Period $period,
        public ?Division $division = null,
        public ?Team $team = null,
    ) {}

    /**
     * @return array{periode: string, dari: string|null, sampai: string|null, divisi: string|null, tim: string|null}
     */
    public function toQuery(): array
    {
        $custom = $this->period->preset->value === 'kustom';

        return [
            'periode' => $this->period->preset->value,
            'dari' => $custom ? $this->period->startDate() : null,
            'sampai' => $custom ? $this->period->lastDate() : null,
            'divisi' => $this->division?->id,
            'tim' => $this->team?->id,
        ];
    }

    /**
     * @return array<string, string|null>
     */
    public function cacheParts(): array
    {
        return [
            'from' => $this->period->startDate(),
            'to' => $this->period->endDate(),
            'preset' => $this->period->preset->value,
            'division' => $this->division?->id,
            'team' => $this->team?->id,
        ];
    }
}
