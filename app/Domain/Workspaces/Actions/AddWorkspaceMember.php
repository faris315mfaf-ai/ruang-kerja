<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Services\WorkspaceMembership;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Adds an employee of the same company to a shared workspace (manual member).
 */
final class AddWorkspaceMember
{
    public function __construct(
        private readonly WorkspaceMembership $membership,
        private readonly RecordActivity $recordActivity,
    ) {}

    public function handle(Workspace $workspace, User $actor, User $member, WorkspaceRole $role): void
    {
        if ($workspace->isPersonal() || $role === WorkspaceRole::Owner) {
            throw ValidationException::withMessages(['user_id' => 'Anggota tidak dapat ditambahkan ke workspace ini.']);
        }

        // Ruang HR: admins of a system workspace follow the HR role (EnsureHrWorkspaces).
        if ($workspace->isSystem() && $role->canManage()) {
            throw ValidationException::withMessages(['role' => 'Admin workspace ini mengikuti peran HR. Tambahkan sebagai member atau viewer.']);
        }

        if ($member->company_id !== $workspace->company_id || ! $member->isActive()) {
            throw ValidationException::withMessages(['user_id' => 'Karyawan tidak ditemukan atau tidak aktif.']);
        }

        $exists = WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->where('user_id', $member->id)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['user_id' => "{$member->name} sudah menjadi anggota."]);
        }

        DB::transaction(function () use ($workspace, $actor, $member, $role): void {
            $this->membership->put($workspace, $member->id, $role);

            $this->recordActivity->handle($workspace, $workspace, $actor, ActivityEvent::MemberAdded, [
                'user_id' => $member->id,
                'name' => $member->name,
                'role' => $role->value,
            ]);

            WorkspaceMembersChanged::dispatch($workspace, [$member->id], []);
        });
    }
}
