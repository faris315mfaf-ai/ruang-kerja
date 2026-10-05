<?php

use App\Domain\Projects\Enums\ProjectStatus;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use App\Models\Workspace;

require_once __DIR__.'/workspace-helpers.php';

/*
 * Helpers for project tracking tests (Sprint 9).
 */

if (! function_exists('makeProject')) {
    /**
     * @param  array<string, mixed>  $attributes
     */
    function makeProject(User $owner, array $attributes = []): Workspace
    {
        return Workspace::factory()->ownedBy($owner)->project()->create([
            'project_status' => ProjectStatus::Active,
            'start_date' => '2026-09-01',
            'target_date' => '2026-10-27',
            ...$attributes,
        ]);
    }

    /**
     * Creates $count tasks in the column of $category.
     *
     * @param  array<string, mixed>  $attributes
     */
    function projectTasks(Workspace $workspace, string $category, int $count = 1, array $attributes = []): void
    {
        $status = TaskStatus::query()->where('workspace_id', $workspace->id)->where('category', $category)->first()
            ?? TaskStatus::factory()->create(['workspace_id' => $workspace->id, 'category' => $category, 'name' => ucfirst($category)]);

        Task::factory()->count($count)->inStatus($status)->create($attributes);
    }
}
