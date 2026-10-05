<?php

namespace App\Domain\Analytics\Data;

use App\Domain\Analytics\Enums\PeriodPreset;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Half-open range of office-local calendar days [start, end). `start` and
 * `end` are midnights in the office timezone; use startUtc()/endUtc() to
 * compare with timestamptz columns and startDate()/endDate() for date columns.
 */
final readonly class Period
{
    private const array MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public function __construct(
        public PeriodPreset $preset,
        public CarbonImmutable $start,
        public CarbonImmutable $end,
    ) {}

    /**
     * The period of a preset containing `now`; custom = [from, to] inclusive.
     * An invalid custom range falls back to the current month.
     */
    public static function resolve(PeriodPreset $preset, ?string $from, ?string $to, CarbonInterface $now): self
    {
        $today = self::officeDate($now);

        return match ($preset) {
            PeriodPreset::Week => new self($preset, $start = $today->startOfWeek(CarbonInterface::MONDAY), $start->addWeek()),
            PeriodPreset::Month => new self($preset, $start = $today->startOfMonth(), $start->addMonthNoOverflow()),
            PeriodPreset::Quarter => new self($preset, $start = $today->startOfQuarter(), $start->addMonthsNoOverflow(3)),
            PeriodPreset::Custom => self::custom($from, $to) ?? self::resolve(PeriodPreset::Month, null, null, $now),
        };
    }

    public static function custom(?string $from, ?string $to): ?self
    {
        if ($from === null || $to === null || ! self::isDate($from) || ! self::isDate($to)) {
            return null;
        }

        $start = self::parseDate($from);
        $end = self::parseDate($to)->addDay();

        if ($end->lte($start)) {
            return null;
        }

        return new self(PeriodPreset::Custom, $start, $end);
    }

    /**
     * The `count` Monday-based weeks ending with the week containing `now`
     * (oldest first) — the 8-week trend.
     *
     * @return list<self>
     */
    public static function weeksEndingAt(CarbonInterface $now, int $count = 8): array
    {
        $current = self::officeDate($now)->startOfWeek(CarbonInterface::MONDAY);
        $weeks = [];

        for ($i = $count - 1; $i >= 0; $i--) {
            $start = $current->subWeeks($i);
            $weeks[] = new self(PeriodPreset::Week, $start, $start->addWeek());
        }

        return $weeks;
    }

    /**
     * The period right before this one, used for "delta vs periode lalu":
     * previous week / month / quarter, or a custom range of the same length.
     */
    public function previous(): self
    {
        return match ($this->preset) {
            PeriodPreset::Week => new self($this->preset, $this->start->subWeek(), $this->start),
            PeriodPreset::Month => new self($this->preset, $this->start->subMonthNoOverflow(), $this->start),
            PeriodPreset::Quarter => new self($this->preset, $this->start->subMonthsNoOverflow(3), $this->start),
            PeriodPreset::Custom => new self($this->preset, $this->start->subDays($this->days()), $this->start),
        };
    }

    /**
     * The part of the period that has started by `now`: a running period ends
     * after today (period-to-date), a future period becomes empty.
     */
    public function toDate(CarbonInterface $now): self
    {
        $tomorrow = self::officeDate($now)->addDay();

        if ($this->end->lte($tomorrow)) {
            return $this;
        }

        return new self($this->preset, $this->start, $this->start->gt($tomorrow) ? $this->start : $tomorrow);
    }

    public function isEmpty(): bool
    {
        return $this->end->lte($this->start);
    }

    public function days(): int
    {
        return (int) round($this->start->diffInDays($this->end));
    }

    public function contains(CarbonInterface $date): bool
    {
        $day = self::officeDate($date);

        return $day->gte($this->start) && $day->lt($this->end);
    }

    /** First day, "Y-m-d" (for date columns, inclusive). */
    public function startDate(): string
    {
        return $this->start->toDateString();
    }

    /** Day after the last day, "Y-m-d" (for date columns, exclusive). */
    public function endDate(): string
    {
        return $this->end->toDateString();
    }

    /** Last day, "Y-m-d" (inclusive). */
    public function lastDate(): string
    {
        return $this->end->subDay()->toDateString();
    }

    public function startUtc(): CarbonImmutable
    {
        return $this->start->utc();
    }

    public function endUtc(): CarbonImmutable
    {
        return $this->end->utc();
    }

    /**
     * "5–11 Okt 2026", "29 Sep – 5 Okt 2026", "28 Des 2026 – 3 Jan 2027".
     */
    public function label(): string
    {
        $first = $this->start;
        $last = $this->end->subDay();

        if ($this->isEmpty() || $first->isSameDay($last)) {
            return $this->day($first, true);
        }

        if ($first->year !== $last->year) {
            return $this->day($first, true).' – '.$this->day($last, true);
        }

        if ($first->month !== $last->month) {
            return $this->day($first, false).' – '.$this->day($last, true);
        }

        return $first->day.'–'.$this->day($last, true);
    }

    /** "17 Agu" — trend axis label. */
    public function shortLabel(): string
    {
        return $this->start->day.' '.self::MONTHS[$this->start->month - 1];
    }

    /**
     * @return array{preset: string, from: string, to: string, label: string, previous_label: string}
     */
    public function toArray(): array
    {
        return [
            'preset' => $this->preset->value,
            'from' => $this->startDate(),
            'to' => $this->lastDate(),
            'label' => $this->label(),
            'previous_label' => $this->preset->previousLabel(),
        ];
    }

    public static function officeDate(CarbonInterface $value): CarbonImmutable
    {
        return CarbonImmutable::instance($value)->setTimezone(self::timezone())->startOfDay();
    }

    public static function parseDate(string $date): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', $date, self::timezone()) ?: CarbonImmutable::parse($date, self::timezone())->startOfDay();
    }

    private static function isDate(string $value): bool
    {
        $parsed = CarbonImmutable::createFromFormat('!Y-m-d', $value, self::timezone());

        return $parsed !== null && $parsed->format('Y-m-d') === $value;
    }

    private static function timezone(): string
    {
        return config()->string('app.office_timezone');
    }

    private function day(CarbonImmutable $date, bool $withYear): string
    {
        return $date->day.' '.self::MONTHS[$date->month - 1].($withYear ? ' '.$date->year : '');
    }
}
