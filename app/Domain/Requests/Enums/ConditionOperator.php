<?php

namespace App\Domain\Requests\Enums;

enum ConditionOperator: string
{
    case Gt = 'gt';
    case Gte = 'gte';
    case Lt = 'lt';
    case Lte = 'lte';

    public function symbol(): string
    {
        return match ($this) {
            self::Gt => '>',
            self::Gte => '≥',
            self::Lt => '<',
            self::Lte => '≤',
        };
    }

    /**
     * Words for "the condition does not hold": 38 jam, tidak lebih dari 40 jam.
     */
    public function failurePhrase(): string
    {
        return match ($this) {
            self::Gt => 'tidak lebih dari',
            self::Gte => 'kurang dari',
            self::Lt => 'tidak kurang dari',
            self::Lte => 'lebih dari',
        };
    }

    public function holds(float $actual, float $threshold): bool
    {
        return match ($this) {
            self::Gt => $actual > $threshold,
            self::Gte => $actual >= $threshold,
            self::Lt => $actual < $threshold,
            self::Lte => $actual <= $threshold,
        };
    }
}
