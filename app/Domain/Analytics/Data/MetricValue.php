<?php

namespace App\Domain\Analytics\Data;

/**
 * Result of one metric for one scope and period. `value` is in the metric's
 * unit (percent 0–100 for rates, count, days, minutes) and null when the
 * metric is undefined (division by zero, no data). Numerator/denominator are
 * kept so the UI can say "11 dari 14 tepat tenggat".
 */
final readonly class MetricValue
{
    public function __construct(
        public ?float $value,
        public float $numerator = 0,
        public float $denominator = 0,
    ) {}

    /** numerator ÷ denominator as a percentage; null when nothing to divide. */
    public static function percentage(float $numerator, float $denominator): self
    {
        return new self($denominator > 0 ? $numerator / $denominator * 100 : null, $numerator, $denominator);
    }

    /** numerator ÷ denominator in the numerator's unit; null when nothing to divide. */
    public static function average(float $numerator, float $denominator): self
    {
        return new self($denominator > 0 ? $numerator / $denominator : null, $numerator, $denominator);
    }

    public static function count(int $count): self
    {
        return new self((float) $count, $count, 0);
    }

    /**
     * Difference to an earlier value (percentage points for rates) computed on
     * the values as displayed (rounded to `precision`), so "78% … +6 poin"
     * always adds up on screen. Null when either side is undefined.
     */
    public function deltaFrom(self $previous, int $precision = 0): ?float
    {
        if ($this->value === null || $previous->value === null) {
            return null;
        }

        return round(round($this->value, $precision) - round($previous->value, $precision), $precision);
    }

    public function rounded(int $precision = 0): ?float
    {
        return $this->value === null ? null : round($this->value, $precision);
    }

    /**
     * @return array{value: float|null, numerator: float, denominator: float}
     */
    public function toArray(int $precision = 0): array
    {
        return [
            'value' => $this->rounded($precision),
            'numerator' => $this->numerator,
            'denominator' => $this->denominator,
        ];
    }

    /**
     * Current + previous period, as sent to StatCard.
     *
     * @return array{value: float|null, numerator: float, denominator: float, previous: float|null, delta: float|null}
     */
    public function compareTo(self $previous, int $precision = 0): array
    {
        return [
            ...$this->toArray($precision),
            'previous' => $previous->rounded($precision),
            'delta' => $this->deltaFrom($previous, $precision),
        ];
    }
}
