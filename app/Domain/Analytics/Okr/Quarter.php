<?php

namespace App\Domain\Analytics\Okr;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use InvalidArgumentException;

/**
 * A calendar quarter "YYYY-Qn" in office dates (features/okr/lib.ts mirrors
 * this: quarterRange, quarterElapsed, quarterWeek).
 */
final readonly class Quarter
{
    public const string PATTERN = '/^\d{4}-Q[1-4]$/';

    private function __construct(public int $year, public int $number) {}

    public static function parse(string $key): self
    {
        if (preg_match(self::PATTERN, $key) !== 1) {
            throw new InvalidArgumentException("Invalid quarter: {$key}");
        }

        return new self((int) substr($key, 0, 4), (int) substr($key, -1));
    }

    public static function tryParse(mixed $key): ?self
    {
        return is_string($key) && preg_match(self::PATTERN, $key) === 1 ? self::parse($key) : null;
    }

    /**
     * Quarter an office date falls in.
     */
    public static function of(CarbonInterface $date): self
    {
        return new self((int) $date->format('Y'), intdiv((int) $date->format('n') - 1, 3) + 1);
    }

    public function key(): string
    {
        return "{$this->year}-Q{$this->number}";
    }

    /** First office date (midnight, UTC-neutral date object). */
    public function start(): CarbonImmutable
    {
        return CarbonImmutable::parse(sprintf('%04d-%02d-01', $this->year, ($this->number - 1) * 3 + 1), 'UTC');
    }

    /** Last office date. */
    public function end(): CarbonImmutable
    {
        return $this->start()->addMonths(3)->subDay();
    }

    /** Days in the quarter (Q4 = 92). */
    public function days(): int
    {
        return (int) $this->start()->diffInDays($this->end()) + 1;
    }

    /**
     * Share of the quarter that has passed by the end of `today` (0–1).
     */
    public function elapsed(CarbonInterface $today): float
    {
        $passed = $this->start()->diffInDays(self::day($today), false) + 1;

        return max(0.0, min(1.0, $passed / $this->days()));
    }

    /**
     * @return array{week: int, weeks: int} current week (1-based, clamped) and weeks in the quarter
     */
    public function week(CarbonInterface $today): array
    {
        $weeks = (int) ceil($this->days() / 7);
        $week = (int) floor($this->start()->diffInDays(self::day($today), false) / 7) + 1;

        return ['week' => max(1, min($weeks, $week)), 'weeks' => $weeks];
    }

    public function previous(): self
    {
        return $this->number === 1 ? new self($this->year - 1, 4) : new self($this->year, $this->number - 1);
    }

    public function next(): self
    {
        return $this->number === 4 ? new self($this->year + 1, 1) : new self($this->year, $this->number + 1);
    }

    /** "Q4 2026". */
    public function label(): string
    {
        return "Q{$this->number} {$this->year}";
    }

    private static function day(CarbonInterface $date): CarbonImmutable
    {
        return CarbonImmutable::parse($date->format('Y-m-d'), 'UTC');
    }
}
