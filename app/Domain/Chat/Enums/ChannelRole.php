<?php

namespace App\Domain\Chat\Enums;

/** channel_members.role: owner/admin moderate (delete others' messages). */
enum ChannelRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Member = 'member';

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'Pemilik',
            self::Admin => 'Admin',
            self::Member => 'Anggota',
        };
    }

    public function canModerate(): bool
    {
        return $this !== self::Member;
    }
}
