<?php

namespace App\Http\Resources\Api\Manajemen;

use App\Domain\Projects\Services\ProjectPresenter;
use App\Models\Milestone;
use App\Models\ProjectDirection;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Illuminate\Support\Facades\Gate;

/**
 * JSON shapes of the project endpoints of the Android app (Bagian 5 / B5-A).
 * Same keys as the web ProjectSummary (resources/js/features/portfolio/types.ts)
 * so one client type covers the detail, the update history and the answers
 * of the write endpoints; abilities come from the very Policies the web
 * buttons use, so the app hides an action instead of hitting a 403.
 */
final class ProjectApi
{
    /**
     * What the viewer may do on the project (WorkspacePolicy::manageProject /
     * steerProject through the Milestone / Risk / Update / Direction policies).
     *
     * @return array{post_update: bool, manage_milestones: bool, manage_risks: bool, request_update: bool, give_direction: bool, resolve_decision: bool, view_only: bool, archived: bool}
     */
    public static function abilities(User $viewer, Workspace $workspace): array
    {
        $gate = Gate::forUser($viewer);
        $steer = $gate->allows('steerProject', $workspace);

        return [
            'post_update' => $gate->allows('create', [ProjectUpdate::class, $workspace]),
            'manage_milestones' => $gate->allows('create', [Milestone::class, $workspace]),
            'manage_risks' => $gate->allows('create', [ProjectRisk::class, $workspace]),
            'request_update' => $steer,
            'give_direction' => $gate->allows('create', [ProjectDirection::class, $workspace]),
            'resolve_decision' => $steer,
            'view_only' => app(WorkspacePolicy::class)->isViewOnly($viewer, $workspace),
            'archived' => $workspace->isArchived(),
        ];
    }

    /**
     * One weekly update with its Direksi replies (load `author`, `resolver`,
     * `directions.author` first).
     *
     * @return array<string, mixed>
     */
    public static function update(ProjectUpdate $update, bool $canSteer): array
    {
        return [
            'id' => $update->id,
            'health' => $update->health->value,
            'summary' => $update->summary,
            'blockers' => $update->blockers,
            'decision_needed' => $update->decision_needed,
            'decision_resolved_at' => $update->decision_resolved_at?->toIso8601String(),
            'decision_resolved_by' => $update->resolver?->name,
            'progress_snapshot' => $update->progress_snapshot !== null ? (float) $update->progress_snapshot : null,
            'planned_snapshot' => $update->planned_snapshot !== null ? (float) $update->planned_snapshot : null,
            'author' => ProjectPresenter::person($update->author),
            'created_at' => $update->created_at->toIso8601String(),
            'directions' => $update->directions->map(fn (ProjectDirection $direction): array => self::direction($direction))->values()->all(),
            'can_resolve' => $canSteer && $update->hasOpenDecision(),
        ];
    }

    /**
     * @return array{id: string, body: string, author: array{id: string, name: string, avatar: string|null}|null, project_update_id: string|null, created_at: string}
     */
    public static function direction(ProjectDirection $direction): array
    {
        return [
            'id' => $direction->id,
            'body' => $direction->body,
            'author' => ProjectPresenter::person($direction->author),
            'project_update_id' => $direction->project_update_id,
            'created_at' => $direction->created_at->toIso8601String(),
        ];
    }

    /**
     * A saved milestone (the derived status comes with GET /proyek/{key}).
     *
     * @return array<string, mixed>
     */
    public static function milestone(Workspace $workspace, Milestone $milestone): array
    {
        $milestone->loadMissing(['tasks' => fn ($query) => $query->orderBy('number')->select(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category'])]);

        return [
            'id' => $milestone->id,
            'name' => $milestone->name,
            'description' => $milestone->description,
            'target_date' => $milestone->target_date->toDateString(),
            'completed_at' => $milestone->completed_at?->toIso8601String(),
            'tasks' => $milestone->tasks->map(fn (Task $task): array => self::taskRef($workspace, $task))->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function risk(Workspace $workspace, ProjectRisk $risk): array
    {
        $risk->loadMissing(['owner:id,name,avatar_url', 'task:id,workspace_id,number,title,status_category']);

        return [
            'id' => $risk->id,
            'title' => $risk->title,
            'level' => $risk->level->value,
            'status' => $risk->status->value,
            'resolved_at' => $risk->resolved_at?->toIso8601String(),
            'owner' => ProjectPresenter::person($risk->owner),
            'task' => $risk->task !== null ? self::taskRef($workspace, $risk->task) : null,
        ];
    }

    /**
     * @return array{id: string, code: string, title: string, status_category: string, status_color: null}
     */
    private static function taskRef(Workspace $workspace, Task $task): array
    {
        return [
            'id' => $task->id,
            'code' => "{$workspace->key}-{$task->number}",
            'title' => $task->title,
            'status_category' => $task->status_category->value,
            'status_color' => null,
        ];
    }
}
