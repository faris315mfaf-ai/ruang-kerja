<?php

namespace App\Domain\Notes\Enums;

/**
 * notes.preset: the template a note was started from. Null = an ordinary
 * note. `minutes` = "Notulensi cepat" from the dashboard (keputusan pemilik
 * 6 Okt 2026).
 */
enum NotePreset: string
{
    case Minutes = 'minutes';

    public function label(): string
    {
        return match ($this) {
            self::Minutes => 'Notulensi',
        };
    }
}
