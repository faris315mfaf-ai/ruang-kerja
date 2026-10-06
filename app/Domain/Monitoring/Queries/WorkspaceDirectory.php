<?php

namespace App\Domain\Monitoring\Queries;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Akses cepat workspace" (keputusan pemilik 6 Okt 2026): every team,
 * division and project workspace the viewer may see — for Direksi, HR and
 * Super Admin all of them (workspaces.view_all / manage), never personal
 * ones. `view_only` marks the ones they are not a member of (WorkspacePolicy
 * isViewOnly: they can look, not change). Three queries in total.
 */
final class WorkspaceDirectory
{
    /**
     * @return list<array<string, mixed>>
     */
    public function for(User $viewer): array
    {
        $types = [WorkspaceType::Division, WorkspaceType::Team, WorkspaceType::Project];

        return array_values(Workspace::query()
            ->visibleTo($viewer)
            ->notArchived()
            ->whereIn('workspaces.type', array_map(fn (WorkspaceType $type): string => $type->value, $types))
            ->withMembershipOf($viewer)
            ->withCount([
                'memberships as members_count',
                'tasks as open_tasks_count' => fn (Builder $tasks) => $tasks->whereNotIn('status_category', TaskStatusCategory::closedValues()),
            ])
            ->orderByRaw("case workspaces.type when 'project' then 0 when 'division' then 1 else 2 end")
            ->orderBy('workspaces.name')
            ->get()
            ->map(fn (Workspace $workspace): array => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'type' => $workspace->type->value,
                'type_label' => $workspace->type->label(),
                'color' => $workspace->color ?? 'gray',
                'url' => $workspace->isProject() ? '/w/'.$workspace->key.'/ringkasan' : '/w/'.$workspace->key,
                'members_count' => (int) $workspace->getAttribute('members_count'),
                'open_tasks_count' => (int) $workspace->getAttribute('open_tasks_count'),
                'view_only' => $workspace->membership === null,
                'health' => $workspace->health?->value,
            ])
            ->all());
    }
}
