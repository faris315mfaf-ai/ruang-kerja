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
 * workspace, or to the root, at the end of the new siblings (lexorank), or at
 * a 0-based `$index` among the siblings the editor can open (same group:
 * folders with folders, notes with notes — the app's reordering). A
 * note can never become its own ancestor: the new parent's chain is walked
 * under a workspace lock, so two concurrent moves cannot build a cycle.
 */
final class MoveNote
{
    /** Safety bound on the ancestor walk (trees are shallow in practice). */
    private const int MAX_DEPTH = 100;

    public function __construct(private readonly NotePolicy $policy) {}

    public function handle(Note $note, User $editor, ?string $parentId, ?int $index = null): Note
    {
        if ($parentId === $note->parent_id && $index === null) {
            return $note;
        }

        return DB::transaction(function () use ($note, $editor, $parentId, $index): Note {
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

            $position = $index === null
                ? $this->endPosition($note, $parentId)
                : $this->positionAt($note, $editor, $parentId, $index);

            $note->forceFill([
                'parent_id' => $parentId,
                'position' => $position,
                'updated_by' => $editor->id,
            ])->save();

            return $note;
        });
    }

    private function endPosition(Note $note, ?string $parentId): string
    {
        $last = Note::query()
            ->where('workspace_id', $note->workspace_id)
            ->where('parent_id', $parentId)
            ->whereKeyNot($note->id)
            ->orderByDesc('position')
            ->value('position');

        return Lexorank::between(is_string($last) ? $last : null, null);
    }

    /**
     * Key that puts the note at `$index` among the visible siblings of its
     * group (the list the editor sees); an index past the end is the end.
     */
    private function positionAt(Note $note, User $editor, ?string $parentId, int $index): string
    {
        $siblings = Note::query()
            ->visibleTo($editor)
            ->where('notes.workspace_id', $note->workspace_id)
            ->where('notes.parent_id', $parentId)
            ->whereKeyNot($note->id)
            ->where('notes.kind', $note->kind->value)
            ->orderBy('notes.position')
            ->orderBy('notes.id')
            ->pluck('notes.position')
            ->all();

        $index = max(0, min($index, count($siblings)));
        $before = $siblings[$index - 1] ?? null;
        $after = $siblings[$index] ?? null;

        // Equal keys (never produced by Lexorank) would make "between" fail.
        if (is_string($before) && is_string($after) && strcmp($before, $after) >= 0) {
            return Lexorank::between(is_string($siblings[count($siblings) - 1] ?? null) ? $siblings[count($siblings) - 1] : null, null);
        }

        return Lexorank::between(is_string($before) ? $before : null, is_string($after) ? $after : null);
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
