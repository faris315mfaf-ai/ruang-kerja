<?php

namespace App\Domain\Notes\Services;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteShareRole;
use App\Models\NoteShare;
use App\Models\User;
use App\Models\Workspace;

/**
 * What the viewer may do with each visible note of ONE workspace, computed
 * with a fixed number of queries (the tree of the mobile app lists hundreds
 * of rows; NotePolicy::canEdit costs several queries per note). It mirrors
 * NotePolicy::canEdit for notes the viewer can already open (tests keep the
 * two in step): personal workspace → edit, invited → the share role,
 * `workspace` access → workspace role may edit tasks, `restricted` → author.
 * Archived workspaces are read-only.
 */
final class NoteViewerRights
{
    /**
     * @param  array<string, NoteShareRole>  $shares  note id → role of the viewer's invitation
     */
    private function __construct(
        private readonly User $viewer,
        private readonly bool $archived,
        private readonly bool $personal,
        private readonly bool $workspaceMayEdit,
        private readonly array $shares,
    ) {}

    /**
     * @param  list<string>  $noteIds  notes whose invitations are looked up
     */
    public static function forWorkspace(User $viewer, Workspace $workspace, array $noteIds): self
    {
        /** @var array<string, NoteShareRole> $shares */
        $shares = $noteIds === []
            ? []
            : NoteShare::query()
                ->where('user_id', $viewer->id)
                ->whereIn('note_id', $noteIds)
                ->get(['note_id', 'role'])
                ->mapWithKeys(fn (NoteShare $share): array => [$share->note_id => $share->role])
                ->all();

        return new self(
            $viewer,
            $workspace->isArchived(),
            $workspace->isPersonal(),
            $workspace->roleOf($viewer)?->canEditTasks() === true,
            $shares,
        );
    }

    public function canEdit(string $noteId, NoteAccess $access, ?string $createdBy): bool
    {
        if ($this->archived) {
            return false;
        }

        if ($this->personal) {
            return true;
        }

        if (isset($this->shares[$noteId])) {
            return $this->shares[$noteId] === NoteShareRole::Edit;
        }

        return match ($access) {
            NoteAccess::Workspace => $this->workspaceMayEdit,
            NoteAccess::Restricted => $createdBy === $this->viewer->id,
        };
    }

    /**
     * `author` (wrote it and may edit), `edit` or `view` (read only).
     *
     * @return 'author'|'edit'|'view'
     */
    public function role(string $noteId, NoteAccess $access, ?string $createdBy): string
    {
        if (! $this->canEdit($noteId, $access, $createdBy)) {
            return 'view';
        }

        return $createdBy === $this->viewer->id ? 'author' : 'edit';
    }
}
