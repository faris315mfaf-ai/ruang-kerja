<?php

namespace App\Domain\Meetings\Enums;

/**
 * meeting_participants.lobby_status: where an external guest stands in the
 * waiting room of ONE occurrence (lobby_occurrence_date).
 */
enum LobbyStatus: string
{
    case None = 'none';
    case Waiting = 'waiting';
    case Admitted = 'admitted';
    case Denied = 'denied';
    case Removed = 'removed';

    public function label(): string
    {
        return match ($this) {
            self::None => 'Belum masuk',
            self::Waiting => 'Menunggu',
            self::Admitted => 'Diizinkan',
            self::Denied => 'Ditolak',
            self::Removed => 'Dikeluarkan',
        };
    }
}
