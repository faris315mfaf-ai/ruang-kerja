<?php

namespace App\Domain\Automation\Queries;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Label;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Eloquent\Collection;

/**
 * The workspaces an automation screen offers to $user — those they belong
 * to, not archived — with their rights, members and labels, in a fixed
 * number of queries (shared by the Otomasi pages).
 */
final class AutomationWorkspaces
{
    /**
     * @return array{workspaces: array<int, array<string, mixed>>, labels: array<int, array<string, mixed>>, people: array<int, array<string, mixed>>}
     */
    public function for(User $user): array
    {
        /** @var Collection<int, Workspace> $workspaces */
        $workspaces = Workspace::query()
            ->where('company_id', $user->company_id)
            ->joinedBy($user)
            ->notArchived()
            ->orderByRaw("CASE WHEN workspaces.type = 'personal' THEN 1 ELSE 0 END")
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'color', 'type', 'owner_id', 'archived_at']);

        $ids = $workspaces->pluck('id')->all();
        $memberships = WorkspaceMember::query()->whereIn('workspace_id', $ids)->get(['workspace_id', 'user_id', 'role'])->groupBy('workspace_id');

        $people = User::query()
            ->whereIn('id', $memberships->flatten()->pluck('user_id')->unique()->values()->all())
            ->active()
            ->with('position:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'position_id']);
        $active = $people->keyBy('id');

        $items = $workspaces->map(function (Workspace $workspace) use ($memberships, $user, $active): array {
            $members = $memberships->get($workspace->id, collect());
            $role = $workspace->type === WorkspaceType::Personal
                ? ($workspace->owner_id === $user->id ? WorkspaceRole::Owner : null)
                : $members->firstWhere('user_id', $user->id)?->role;

            return [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->type === WorkspaceType::Personal ? 'Pribadi' : $workspace->name,
                'color' => $workspace->color ?? 'gray',
                'type' => $workspace->type->value,
                'can_manage' => $role?->canManage() ?? false,
                'can_edit_tasks' => $role?->canEditTasks() ?? false,
                'member_ids' => $members->pluck('user_id')->filter(fn (string $id): bool => $active->has($id))->values()->all(),
            ];
        })->values()->all();

        $labels = Label::query()
            ->whereIn('workspace_id', $ids)
            ->orderBy('name')
            ->get(['id', 'workspace_id', 'name', 'color'])
            ->map(fn (Label $label): array => [
                'id' => $label->id,
                'workspace_id' => $label->workspace_id,
                'name' => $label->name,
                'color' => $label->color,
            ])
            ->values()
            ->all();

        return [
            'workspaces' => $items,
            'labels' => $labels,
            'people' => $people->map(fn (User $person): array => [
                'id' => $person->id,
                'name' => $person->name,
                'title' => $person->position?->name,
            ])->values()->all(),
        ];
    }
}
