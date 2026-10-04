<?php

namespace App\Domain\Tasks\Enums;

/**
 * tasks.priority (smallint): 0 none · 1 urgent · 2 high · 3 medium · 4 low.
 */
enum TaskPriority: int
{
    case None = 0;
    case Urgent = 1;
    case High = 2;
    case Medium = 3;
    case Low = 4;

    public function label(): string
    {
        return match ($this) {
            self::None => 'Tanpa',
            self::Urgent => 'Urgent',
            self::High => 'Tinggi',
            self::Medium => 'Sedang',
            self::Low => 'Rendah',
        };
    }

    /**
     * Sort weight: urgent first, "none" last.
     */
    public function sortWeight(): int
    {
        return $this === self::None ? 5 : $this->value;
    }
}
