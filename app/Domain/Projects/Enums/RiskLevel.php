<?php

namespace App\Domain\Projects\Enums;

enum RiskLevel: string
{
    case High = 'high';
    case Medium = 'medium';
    case Low = 'low';

    public function label(): string
    {
        return match ($this) {
            self::High => 'Tinggi',
            self::Medium => 'Sedang',
            self::Low => 'Rendah',
        };
    }

    public function rank(): int
    {
        return match ($this) {
            self::High => 0,
            self::Medium => 1,
            self::Low => 2,
        };
    }
}
