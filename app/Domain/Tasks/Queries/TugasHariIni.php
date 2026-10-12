<?php

namespace App\Domain\Tasks\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;

/**
 * "Tugas hari ini" (dashboard): the viewer's tasks due today — office date —
 * in three segments (keputusan pemilik 9 Okt 2026, "rencana kerja jadi tugas
 * otomatis"):
 *
 * - `pribadi`: tasks in the viewer's own personal workspace (including the
 *   ones generated from a check-in work plan);
 * - `tim`: tasks ASSIGNED TO THE VIEWER in the non-personal workspaces they
 *   are a member of (team, division, project) and may see — not archived,
 *   like MyTasks; colleagues' tasks due today are not the viewer's to do;
 * - `semua`: both combined, in the same order.
 *
 * Each item carries `assigned_by_other`: the viewer is an assignee and the
 * assignment was made by someone else (task_assignees.assigned_by ≠ viewer),
 * for the "Dari atasan" badge — such a task is closed to edits for the
 * viewer (TaskPolicy). Order: open first, then urgent → low with "tanpa
 * prioritas" last, then number.
 *
 * A fixed number of queries whatever the task count (workspace ids, tasks,
 * eager loads) — no N+1.
 */
final class TugasHariIni
{
    /**
     * @return array{today: string, pribadi: list<array<string, mixed>>, tim: list<array<string, mixed>>, semua: list<array<string, mixed>>, counts: array{pribadi: int, tim: int, semua: int}}
     */
    public function for(User $viewer, ?CarbonImmutable $now = null): array
    {
        $today = Period::officeDate($now ?? CarbonImmutable::now())->toDateString();

        $personalId = Workspace::query()
            ->visibleTo($viewer)
            ->where('type', WorkspaceType::Personal->value)
            ->where('owner_id', $viewer->id)
            ->value('id');

        $teamIds = Workspace::query()
            ->visibleTo($viewer)
            ->notArchived()
            ->where('type', '!=', WorkspaceType::Personal->value)
            ->whereHas('memberships', fn ($member) => $member->where('user_id', $viewer->id))
            ->pluck('id');

        $closed = TaskStatusCategory::closedValues();

        $assignedToViewer = fn (QueryBuilder $sub): QueryBuilder => $sub->selectRaw('1')
            ->from('task_assignees')
            ->whereColumn('task_assignees.task_id', 'tasks.id')
            ->where('task_assignees.user_id', $viewer->id);

        $tasks = Task::query()
            ->select('tasks.*')
            ->selectRaw(
                'exists (select 1 from task_assignees ta where ta.task_id = tasks.id and ta.user_id = ? and ta.assigned_by is not null and ta.assigned_by <> ?) as assigned_by_other',
                [$viewer->id, $viewer->id],
            )
            ->visibleTo($viewer)
            ->where(fn (Builder $scope): Builder => $scope
                ->when($personalId !== null, fn (Builder $own): Builder => $own->orWhere('tasks.workspace_id', $personalId))
                ->orWhere(fn (Builder $team): Builder => $team
                    ->whereIn('tasks.workspace_id', $teamIds->all())
                    ->whereExists($assignedToViewer)))
            ->whereDate('tasks.due_date', $today)
            ->with(['workspace:id,key,name', 'status:id,name,category', 'assignees:id,name'])
            // Open tasks first, then urgent → low with "tanpa prioritas" (0)
            // last, oldest first.
            ->orderByRaw('CASE WHEN tasks.status_category IN ('.implode(',', array_fill(0, count($closed), '?')).') THEN 1 ELSE 0 END', $closed)
            ->orderByRaw('CASE WHEN tasks.priority = 0 THEN 1 ELSE 0 END')
            ->orderBy('tasks.priority')
            ->orderBy('tasks.number')
            ->get();

        $pribadi = $tasks->filter(fn (Task $task): bool => $task->workspace_id === $personalId)->values();
        $tim = $tasks->filter(fn (Task $task): bool => $task->workspace_id !== $personalId)->values();

        $items = fn (Collection $rows): array => array_values($rows->map(fn (Task $task): array => $this->item($task))->all());
        $pribadiItems = $items($pribadi);
        $timItems = $items($tim);

        return [
            'today' => $today,
            'pribadi' => $pribadiItems,
            'tim' => $timItems,
            'semua' => [...$pribadiItems, ...$timItems],
            'counts' => [
                'pribadi' => count($pribadiItems),
                'tim' => count($timItems),
                'semua' => count($pribadiItems) + count($timItems),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function item(Task $task): array
    {
        return [
            'id' => $task->id,
            'key' => $task->displayKey(),
            'title' => $task->title,
            'workspace' => [
                'key' => $task->workspace->key,
                'name' => $task->workspace->name,
            ],
            'status' => [
                'name' => $task->status->name,
                'category' => $task->status->category->value,
                'is_done' => $task->isClosed(),
            ],
            'priority' => $task->priority->label(),
            'assignees' => $task->assignees->map(fn (User $user): string => $user->name)->all(),
            'source' => $task->source->value,
            // The viewer was assigned this task by someone else ("Dari atasan").
            'assigned_by_other' => (bool) $task->getAttribute('assigned_by_other'),
            'url' => $task->url(),
        ];
    }
}
