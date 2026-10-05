<?php

namespace App\Domain\Attendance\Data;

use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\OfficeClock;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * A recap month (office dates). Counting stops at today for the running month;
 * a future month has no counted days.
 */
final readonly class RecapPeriod
{
    public function __construct(
        public CarbonImmutable $monthStart,
        public CarbonImmutable $monthEnd,
        public ?CarbonImmutable $countedUntil,
    ) {}

    public static function forMonth(string $month, CarbonInterface $now): self
    {
        $start = ScheduleResolver::parseDate($month.'-01')->startOfMonth();
        $end = $start->endOfMonth()->startOfDay();
        $today = ScheduleResolver::officeDate($now);

        return new self($start, $end, match (true) {
            $today->lt($start) => null,
            $today->lt($end) => $today,
            default => $end,
        });
    }

    /**
     * "2026-09" from a query value, falling back to the current month.
     */
    public static function normalize(?string $value, CarbonInterface $now): string
    {
        if ($value !== null && preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $value) === 1 && (int) substr($value, 0, 4) >= 2000) {
            return $value;
        }

        return OfficeClock::local($now)->format('Y-m');
    }

    public function key(): string
    {
        return $this->monthStart->format('Y-m');
    }

    public function isRunning(): bool
    {
        return $this->countedUntil !== null && $this->countedUntil->lt($this->monthEnd);
    }

    /**
     * "September 2026".
     */
    public function label(): string
    {
        return self::MONTHS[$this->monthStart->month - 1].' '.$this->monthStart->year;
    }

    public const array MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
}
