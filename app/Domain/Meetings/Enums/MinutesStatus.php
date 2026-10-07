<?php

namespace App\Domain\Meetings\Enums;

/** meeting_minutes.status: a final record is locked until reopened. */
enum MinutesStatus: string
{
    case Draft = 'draft';
    case Final = 'final';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Notulen draf',
            self::Final => 'Notulen final',
        };
    }
}
