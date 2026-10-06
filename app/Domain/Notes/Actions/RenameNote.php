<?php

namespace App\Domain\Notes\Actions;

use App\Models\Note;
use App\Models\User;

/**
 * Title of a note (the title is not part of the Yjs document). Blank
 * becomes "Tanpa judul".
 */
final class RenameNote
{
    public function handle(Note $note, User $editor, string $title): Note
    {
        $title = CreateNote::normalizeTitle($title, $note->kind);

        if ($title !== $note->title) {
            $note->forceFill(['title' => $title, 'updated_by' => $editor->id])->save();
        }

        return $note;
    }
}
