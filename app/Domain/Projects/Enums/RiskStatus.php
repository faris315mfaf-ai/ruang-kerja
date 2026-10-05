<?php

namespace App\Domain\Projects\Enums;

enum RiskStatus: string
{
    case Open = 'open';
    case Resolved = 'resolved';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Terbuka',
            self::Resolved => 'Teratasi',
        };
    }
}
