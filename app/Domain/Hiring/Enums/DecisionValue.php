<?php

namespace App\Domain\Hiring\Enums;

enum DecisionValue: string
{
    case Approve = 'approve';
    case Reject = 'reject';

    public function label(): string
    {
        return match ($this) {
            self::Approve => 'Disetujui',
            self::Reject => 'Ditolak',
        };
    }
}
