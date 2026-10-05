<?php

namespace App\Domain\Workspaces\Queries;

use App\Models\User;
use App\Models\Workspace;

/**
 * Shared Inertia prop `workspaces`: the user's workspaces for the sidebar and
 * the mobile Menu grid (members only, not archived). Grouped and ordered on
 * the client: Pribadi, Divisi, Tim, Proyek; favorites first.
 */
final class SidebarWorkspaces
{
    /**
     * @return list<array{id: string, key: string, name: string, type: string, color: string, favorite: bool}>
     */
    public function for(User $user): array
    {
        return array_values(Workspace::query()
            ->joinedBy($user)
            ->notArchived()
            ->withMembershipOf($user)
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'type', 'color', 'owner_id'])
            ->sortBy(fn (Workspace $workspace): string => $workspace->type->sortOrder()
                .($workspace->membership?->favorited_at === null ? '1' : '0'.$workspace->membership->favorited_at->format('YmdHis'))
                .mb_strtolower($workspace->name))
            ->map(fn (Workspace $workspace): array => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'type' => $workspace->type->value,
                'color' => $workspace->color ?? 'gray',
                'favorite' => $workspace->membership?->favorited_at !== null,
            ])
            ->all());
    }
}
