<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Events\Workspaces\WorkspaceMembersChanged;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Changes the role of a member (admin/member/viewer). The owner's role is
 * fixed. Audited as a role change.
 */
final class UpdateWorkspaceMemberRole
{
    public function __construct(
        private readonly RecordActivity $recordActivity,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Workspace $workspace, User $actor, User $member, WorkspaceRole $role): void
    {
        $current = $workspace->roleOf($member);

        if ($current === null) {
            throw ValidationException::withMessages(['role' => "{$member->name} bukan anggota workspace ini."]);
        }

        if ($current === WorkspaceRole::Owner || $role === WorkspaceRole::Owner || $member->id === $workspace->owner_id) {
            throw ValidationException::withMessages(['role' => 'Peran owner tidak dapat diubah di sini.']);
        }

        if ($current === $role) {
            return;
        }

        DB::transaction(function () use ($workspace, $actor, $member, $current, $role): void {
            WorkspaceMember::query()
                ->where('workspace_id', $workspace->id)
                ->where('user_id', $member->id)
                ->update(['role' => $role->value, 'updated_at' => now()]);

            $this->recordActivity->handle($workspace, $workspace, $actor, ActivityEvent::MemberRoleChanged, [
                'user_id' => $member->id,
                'name' => $member->name,
                'from' => $current->value,
                'to' => $role->value,
            ]);

            $this->audit->log(
                'workspace.member_role_changed',
                $workspace,
                ['user_id' => $member->id, 'role' => $current->value],
                ['user_id' => $member->id, 'role' => $role->value],
                $actor,
            );

            WorkspaceMembersChanged::dispatch($workspace, [], []);
        });
    }
}
