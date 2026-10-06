<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\NotePolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Moves a note (with its sub-notes) under another note of the same
 * workspace, or to the root, at the end of the new siblings (lexorank). A
 * note can never become its own ancestor: the new parent's chain is walked
 * under a workspace lock, so two concurrent moves cannot build a cycle.
 */
final class MoveNote
{
    /** Safety bound on the ancestor walk (trees are shallow in practice). */
    private const int MAX_DEPTH = 100;

    public function __construct(private readonly NotePolicy $policy) {}

    public function handle(Note $note, User $editor, ?string $parentId): Note
    {
        if ($parentId === $note->parent_id) {
            return $note;
        }

        return DB::transaction(function () use ($note, $editor, $parentId): Note {
            Workspace::query()->whereKey($note->workspace_id)->lockForUpdate()->first();

            if ($parentId !== null) {
                $parent = Note::query()->where('workspace_id', $note->workspace_id)->find($parentId);

                if ($parent === null || ! $this->policy->canView($editor, $parent)) {
                    throw ValidationException::withMessages(['parent_id' => 'Folder atau catatan induk tidak ditemukan di workspace ini.']);
                }

                CreateNote::assertParentAccepts($parent, $note->kind);

                if ($this->isDescendantOrSelf($parent, $note)) {
                    throw ValidationException::withMessages(['parent_id' => 'Catatan tidak bisa dipindahkan ke dalam dirinya sendiri atau sub-catatannya.']);
                }
            }

            $last = Note::query()
                ->where('workspace_id', $note->workspace_id)
                ->where('parent_id', $parentId)
                ->whereKeyNot($note->id)
                ->orderByDesc('position')
                ->value('position');

            $note->forceFill([
                'parent_id' => $parentId,
                'position' => Lexorank::between(is_string($last) ? $last : null, null),
                'updated_by' => $editor->id,
            ])->save();

            return $note;
        });
    }

    /** Is `$candidate` the note itself or one of its descendants? */
    private function isDescendantOrSelf(Note $candidate, Note $note): bool
    {
        $currentId = $candidate->id;

        for ($depth = 0; $currentId !== null && $depth < self::MAX_DEPTH; $depth++) {
            if ($currentId === $note->id) {
                return true;
            }

            $parentId = Note::withTrashed()->whereKey($currentId)->value('parent_id');
            $currentId = is_string($parentId) ? $parentId : null;
        }

        return $currentId !== null;
    }
}
