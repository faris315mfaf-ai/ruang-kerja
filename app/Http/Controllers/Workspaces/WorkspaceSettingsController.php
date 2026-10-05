<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Projects\Queries\ProjectSettings;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Models\Label;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tab "Pengaturan" (mockup WorkspacePengaturan): general, members, columns,
 * labels, danger zone. Everyone who can see the workspace can read the
 * members; changes need WorkspacePolicy::update / manageMembers.
 */
class WorkspaceSettingsController extends Controller
{
    public function show(Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page, ProjectSettings $projectSettings): Response
    {
        Gate::authorize('view', $workspace);

        $props = $page->props($workspace, $user);

        return Inertia::render('workspaces/settings', [
            ...$props,
            'member_details' => fn (): array => $this->memberDetails($workspace),
            'statuses' => fn (): array => TaskStatus::query()
                ->where('workspace_id', $workspace->id)
                ->withCount('tasks')
                ->orderBy('position')
                ->get()
                ->map(fn (TaskStatus $status): array => [
                    'id' => $status->id,
                    'name' => $status->name,
                    'category' => $status->category->value,
                    'color' => $status->color,
                    'position' => $status->position,
                    'tasks_count' => (int) ($status->getAttribute('tasks_count') ?? 0),
                ])
                ->values()
                ->all(),
            'labels' => fn (): array => Label::query()
                ->where('workspace_id', $workspace->id)
                ->withCount(['tasks' => fn (Builder $query) => $query->whereNotIn('status_category', TaskStatusCategory::closedValues())])
                ->orderBy('name')
                ->get()
                ->map(fn (Label $label): array => [
                    'id' => $label->id,
                    'name' => $label->name,
                    'color' => $label->color,
                    'tasks_count' => (int) ($label->getAttribute('tasks_count') ?? 0),
                ])
                ->values()
                ->all(),
            'candidates' => fn (): array => $props['can']['manage_members'] ? $this->candidates($workspace, $user) : [],
            'role_options' => array_map(
                fn (WorkspaceRole $role): array => ['value' => $role->value, 'label' => $role->label()],
                WorkspaceRole::assignable(),
            ),
            // Sprint 9: Pengaturan › Proyek (null for other workspace types).
            'project_settings' => fn (): ?array => $projectSettings->props($workspace),
            'category_options' => array_map(
                fn (TaskStatusCategory $category): array => ['value' => $category->value, 'label' => $category->label()],
                TaskStatusCategory::cases(),
            ),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function memberDetails(Workspace $workspace): array
    {
        return array_values(WorkspaceMember::query()
            ->where('workspace_id', $workspace->id)
            ->with(['user:id,name,avatar_url,division_id,position_id', 'user.division:id,name', 'user.position:id,name'])
            ->get()
            ->sortBy(fn (WorkspaceMember $member): string => (5 - $member->role->rank()).mb_strtolower($member->user->name))
            ->map(fn (WorkspaceMember $member): array => [
                'id' => $member->user_id,
                'name' => $member->user->name,
                'avatar' => $member->user->avatar_url,
                'role' => $member->role->value,
                'is_synced' => $member->is_synced,
                'division' => $member->user->division?->name,
                'position' => $member->user->position?->name,
                'joined_at' => $member->joined_at?->toIso8601String(),
            ])
            ->all());
    }

    /**
     * Active employees of the company who are not members yet.
     *
     * @return list<array{id: string, name: string, email: string, division: string|null}>
     */
    private function candidates(Workspace $workspace, User $user): array
    {
        return array_values(User::query()
            ->active()
            ->where('company_id', $workspace->company_id)
            ->whereNotIn('id', WorkspaceMember::query()->where('workspace_id', $workspace->id)->select('user_id'))
            ->with('division:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'division_id'])
            ->map(fn (User $candidate): array => [
                'id' => $candidate->id,
                'name' => $candidate->name,
                'email' => $candidate->email,
                'division' => $candidate->division?->name,
            ])
            ->all());
    }
}
