<?php

namespace App\Domain\Notes\Enums;

/**
 * notes.kind: a note holds a (collaborative) document, a folder only groups
 * notes and folders. Folders live at the root or inside another folder;
 * notes may sit under a folder or under another note (sub-page).
 */
enum NoteKind: string
{
    case Note = 'note';
    case Folder = 'folder';

    public function label(): string
    {
        return match ($this) {
            self::Note => 'Catatan',
            self::Folder => 'Folder',
        };
    }

    public function isFolder(): bool
    {
        return $this === self::Folder;
    }
}
