<?php

namespace App\Domain\Tasks\Queries;

use App\Domain\Analytics\Data\Period;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * "Tugas hari ini" (dashboard): the viewer's tasks due today — office date —
 * in three segments (keputusan pemilik 9 Okt 2026, "rencana kerja jadi tugas
 * otomatis"):
 *
 * - `pribadi`: tasks in the viewer's own personal workspace (including the
 *   ones generated from a check-in work plan);
 * - `tim`: tasks in the non-personal workspaces the viewer is a member of
 *   (team, division, project) and may see — not archived, like MyTasks;
 * - `semua`: both combined, in the same order.
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

        $workspaceIds = $teamIds->push($personalId)->filter()->all();
        $closed = TaskStatusCategory::closedValues();

        $tasks = Task::query()
            ->visibleTo($viewer)
            ->whereIn('tasks.workspace_id', $workspaceIds)
            ->whereDate('tasks.due_date', $today)
            ->with(['workspace:id,key,name', 'status:id,name,category', 'assignees:id,name'])
            // Open tasks first, then urgent → low, oldest first.
            ->orderByRaw('CASE WHEN tasks.status_category IN ('.implode(',', array_fill(0, count($closed), '?')).') THEN 1 ELSE 0 END', $closed)
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
            'url' => $task->url(),
        ];
    }
}
