<?php

namespace App\Domain\Workspaces\Actions;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Services\MemberSynchronizer;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

/**
 * Team workspaces linked to a team (workspaces.team_id) get every active team
 * member as `member` and the Ketua Tim as `admin`; the creator stays owner.
 */
final class SyncTeamMembers
{
    public function __construct(private readonly MemberSynchronizer $synchronizer) {}

    public function handle(Team $team): void
    {
        $workspaces = Workspace::query()
            ->where('type', WorkspaceType::Team->value)
            ->where('team_id', $team->id)
            ->get();

        if ($workspaces->isEmpty()) {
            return;
        }

        /** @var list<string> $memberIds */
        $memberIds = User::query()->active()->where('team_id', $team->id)->pluck('id')->all();

        foreach ($workspaces as $workspace) {
            $desired = array_fill_keys($memberIds, WorkspaceRole::Member);

            if ($team->lead_user_id !== null && User::query()->active()->whereKey($team->lead_user_id)->exists()) {
                $desired[$team->lead_user_id] = WorkspaceRole::Admin;
            }

            $desired[$workspace->owner_id] = WorkspaceRole::Owner;

            $this->synchronizer->sync($workspace, $desired);
        }
    }
}
