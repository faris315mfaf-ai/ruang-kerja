<?php

namespace App\Domain\Notes\Actions;

use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deletes a note. Its sub-notes move up to the deleted note's parent
 * (they are not deleted with it), keeping the tree intact.
 */
final class DeleteNote
{
    public function handle(Note $note, User $actor): void
    {
        DB::transaction(function () use ($note, $actor): void {
            Workspace::query()->whereKey($note->workspace_id)->lockForUpdate()->first();

            Note::query()
                ->where('parent_id', $note->id)
                ->update(['parent_id' => $note->parent_id]);

            $note->forceFill(['updated_by' => $actor->id])->save();
            $note->delete();
        });
    }
}
