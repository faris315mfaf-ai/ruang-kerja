<?php

namespace App\Domain\Monitoring\Actions;

use App\Models\ManagementNote;

/**
 * Removes a "catatan tindakan" (owner only, ManagementNotePolicy::delete).
 * Private to-do items are not history: the row is deleted.
 */
final class DeleteManagementNote
{
    public function handle(ManagementNote $note): void
    {
        $note->delete();
    }
}
