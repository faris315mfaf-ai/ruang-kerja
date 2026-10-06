<?php

namespace App\Domain\Okr\Enums;

/**
 * Life cycle of an objective: drafted by the Kepala Divisi, active during the
 * quarter, closed (read-only) at the end.
 */
enum ObjectiveStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draf',
            self::Active => 'Aktif',
            self::Closed => 'Ditutup',
        };
    }
}
