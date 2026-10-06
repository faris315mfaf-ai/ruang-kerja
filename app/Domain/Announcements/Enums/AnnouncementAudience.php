<?php

namespace App\Domain\Announcements\Enums;

/**
 * Who receives an announcement (announcements.audience).
 */
enum AnnouncementAudience: string
{
    case All = 'all';
    case Division = 'division';
    case Team = 'team';

    public function label(): string
    {
        return match ($this) {
            self::All => 'Semua karyawan',
            self::Division => 'Divisi tertentu',
            self::Team => 'Tim tertentu',
        };
    }
}
