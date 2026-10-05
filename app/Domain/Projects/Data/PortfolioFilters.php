<?php

namespace App\Domain\Projects\Data;

use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Services\ProjectClock;
use Carbon\CarbonImmutable;

/**
 * Filters of /portofolio, kept in the URL: ?periode=kuartal|bulan|semua
 * &divisi={id}&status={health}&arsip=1.
 */
final readonly class PortfolioFilters
{
    public const array PERIODS = ['kuartal', 'bulan', 'semua'];

    public function __construct(
        public string $period = 'kuartal',
        public ?string $divisionId = null,
        public ?ProjectHealth $health = null,
        public bool $archive = false,
    ) {}

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null [start, end] office dates; null for "semua"
     */
    public function range(CarbonImmutable $today): ?array
    {
        return match ($this->period) {
            'bulan' => [$today->startOfMonth(), $today->endOfMonth()->startOfDay()],
            'semua' => null,
            default => [$today->startOfQuarter(), $today->endOfQuarter()->startOfDay()],
        };
    }

    public function label(CarbonImmutable $today): string
    {
        return match ($this->period) {
            'bulan' => ProjectClock::monthName($today->month).' '.$today->year,
            'semua' => 'Semua periode',
            default => 'Q'.$today->quarter.' '.$today->year,
        };
    }

    /**
     * @return array{periode: string, divisi: string|null, status: string|null, arsip: bool}
     */
    public function toArray(): array
    {
        return [
            'periode' => $this->period,
            'divisi' => $this->divisionId,
            'status' => $this->health?->value,
            'arsip' => $this->archive,
        ];
    }
}
