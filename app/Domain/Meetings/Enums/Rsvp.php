<?php

namespace App\Domain\Meetings\Enums;

/** meeting_participants.rsvp: a participant's answer to the invitation. */
enum Rsvp: string
{
    case Pending = 'pending';
    case Yes = 'yes';
    case Maybe = 'maybe';
    case No = 'no';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Belum menjawab',
            self::Yes => 'Hadir',
            self::Maybe => 'Mungkin',
            self::No => 'Tidak hadir',
        };
    }
}
