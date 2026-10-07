<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Services\ChannelMembership;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The automatic channel of a non-personal workspace (PRD §6): created on
 * demand, named after the workspace, members mirrored from workspace_members
 * (owner → owner, admin → admin, others → member). Idempotent; personal
 * workspaces never get one. Reading follows the workspace (ChannelPolicy).
 */
final class SyncWorkspaceChannel
{
    public function __construct(private readonly ChannelMembership $membership) {}

    public function handle(Workspace $workspace): ?Channel
    {
        if ($workspace->isPersonal()) {
            return null;
        }

        return DB::transaction(function () use ($workspace): Channel {
            $name = Str::limit($workspace->name, 80, '');

            $channel = Channel::query()->firstOrCreate(
                ['type' => ChannelType::Workspace, 'workspace_id' => $workspace->id],
                ['company_id' => $workspace->company_id, 'name' => $name, 'created_by' => $workspace->owner_id],
            );

            if ($channel->name !== $name) {
                $channel->forceFill(['name' => $name])->save();
            }

            /** @var array<string, ChannelRole> $desired */
            $desired = WorkspaceMember::query()
                ->where('workspace_id', $workspace->id)
                ->get(['user_id', 'role'])
                ->mapWithKeys(fn (WorkspaceMember $member): array => [$member->user_id => match ($member->role) {
                    WorkspaceRole::Owner => ChannelRole::Owner,
                    WorkspaceRole::Admin => ChannelRole::Admin,
                    default => ChannelRole::Member,
                }])
                ->all();

            /** @var array<string, string> $current */
            $current = ChannelMember::query()->where('channel_id', $channel->id)->pluck('role', 'user_id')->all();

            ChannelMember::query()
                ->where('channel_id', $channel->id)
                ->whereNotIn('user_id', array_keys($desired))
                ->delete();

            $this->membership->add($channel, array_diff_key($desired, $current));

            foreach (array_intersect_key($desired, $current) as $userId => $role) {
                if ($current[$userId] !== $role->value) {
                    ChannelMember::query()
                        ->where('channel_id', $channel->id)
                        ->where('user_id', $userId)
                        ->update(['role' => $role->value, 'updated_at' => now()]);
                }
            }

            return $channel;
        });
    }
}
