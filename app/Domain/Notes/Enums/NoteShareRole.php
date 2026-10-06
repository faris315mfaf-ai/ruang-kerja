<?php

namespace App\Domain\Notes\Enums;

/** note_shares.role: an invited person edits or only reads the note. */
enum NoteShareRole: string
{
    case Edit = 'edit';
    case View = 'view';

    public function label(): string
    {
        return match ($this) {
            self::Edit => 'Menyunting',
            self::View => 'Membaca',
        };
    }
}
