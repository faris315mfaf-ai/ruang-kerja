<?php

namespace App\Policies;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteShareRole;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Note;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Auth\Access\Response;

/**
 * Catatan bersama (docs/fitur/catatan.md, decision 11 Oct 2026):
 *
 * - Personal workspace: only its owner (no sharing).
 * - Invited (note_shares): the share role decides (edit / view), also when
 *   the person is not in the workspace.
 * - access = workspace: everyone who sees the workspace (WorkspacePolicy::
 *   canView, so Direksi and internal workspaces read it); members who may
 *   edit tasks (owner/admin/member) edit, workspace viewers read.
 * - access = restricted: only the author and the invited people — no global
 *   role (Direksi, HR, Super Admin) sees it automatically.
 * - Archived workspace: read-only. Not visible → 404, visible but not
 *   allowed → 403. No Gate::before.
 */
class NotePolicy
{
    public function __construct(private readonly WorkspacePolicy $workspaces) {}

    /** Lists always go through Note::visibleTo(). */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /** New note in a workspace: personal owner, or a member who may edit tasks. */
    public function create(User $user, Workspace $workspace): Response
    {
        if (! $this->workspaces->canView($user, $workspace)) {
            return Response::denyAsNotFound();
        }

        return $this->canCreateIn($user, $workspace)
            ? Response::allow()
            : Response::deny('Anda tidak dapat membuat catatan di workspace ini.');
    }

    public function view(User $user, Note $note): Response
    {
        return $this->canView($user, $note) ? Response::allow() : Response::denyAsNotFound();
    }

    /** Edit title and content, move, restore a version. */
    public function update(User $user, Note $note): Response
    {
        return $this->gate($user, $note, $this->canEdit($user, $note), 'Anda hanya dapat membaca catatan ini.');
    }

    /** General access and invited people. */
    public function share(User $user, Note $note): Response
    {
        return $this->gate($user, $note, $this->canShare($user, $note), 'Hanya penulis catatan atau admin workspace yang dapat mengatur akses.');
    }

    public function delete(User $user, Note $note): Response
    {
        return $this->gate($user, $note, $this->canDelete($user, $note), 'Hanya penulis catatan atau admin workspace yang dapat menghapus catatan.');
    }

    public function canView(User $user, Note $note): bool
    {
        if ($user->status !== UserStatus::Active || $note->company_id !== $user->company_id || $note->trashed()) {
            return false;
        }

        $workspace = $note->workspace;

        if ($workspace === null || $workspace->company_id !== $user->company_id) {
            return false;
        }

        if ($workspace->isPersonal()) {
            return $workspace->owner_id === $user->id;
        }

        if ($note->shareOf($user) !== null) {
            return true;
        }

        return match ($note->access) {
            NoteAccess::Workspace => $this->workspaces->canView($user, $workspace),
            NoteAccess::Restricted => $note->created_by !== null && $note->created_by === $user->id,
        };
    }

    public function canEdit(User $user, Note $note): bool
    {
        if (! $this->canView($user, $note)) {
            return false;
        }

        $workspace = $note->workspace;

        if ($workspace === null || $workspace->isArchived()) {
            return false;
        }

        if ($workspace->isPersonal()) {
            return true;
        }

        $share = $note->shareOf($user);

        if ($share !== null) {
            return $share->role === NoteShareRole::Edit;
        }

        return match ($note->access) {
            NoteAccess::Workspace => $workspace->roleOf($user)?->canEditTasks() === true,
            NoteAccess::Restricted => $note->created_by === $user->id,
        };
    }

    public function canShare(User $user, Note $note): bool
    {
        $workspace = $note->workspace;

        if ($workspace === null || $workspace->isPersonal() || $workspace->isArchived() || ! $this->canView($user, $note)) {
            return false;
        }

        return $note->created_by === $user->id || $workspace->roleOf($user)?->canManage() === true;
    }

    public function canDelete(User $user, Note $note): bool
    {
        $workspace = $note->workspace;

        if ($workspace === null || $workspace->isArchived() || ! $this->canView($user, $note)) {
            return false;
        }

        if ($workspace->isPersonal()) {
            return true;
        }

        return $note->created_by === $user->id || $workspace->roleOf($user)?->canManage() === true;
    }

    public function canCreateIn(User $user, Workspace $workspace): bool
    {
        if ($user->status !== UserStatus::Active || $workspace->isArchived() || ! $this->workspaces->canView($user, $workspace)) {
            return false;
        }

        if ($workspace->isPersonal()) {
            return $workspace->owner_id === $user->id;
        }

        return $workspace->roleOf($user)?->canEditTasks() === true;
    }

    private function gate(User $user, Note $note, bool $allowed, string $message): Response
    {
        if ($allowed) {
            return Response::allow();
        }

        return $this->canView($user, $note) ? Response::deny($message) : Response::denyAsNotFound();
    }
}
