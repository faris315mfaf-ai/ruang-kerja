<?php

namespace App\Http\Resources\Api;

use App\Domain\Planner\Services\LanePlacement;
use App\Http\Resources\PersonResource;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * One row of "Tugas saya" / sub-task lists in the mobile app: the compact
 * TaskSummary plus what a card needs without another request — labels, the
 * checklist progress, the people, the due-date group hint (`group`) and the
 * viewer's own planner lane (`plan`). Eager-load `workspace:id,key,name,type`,
 * `status`, `assignees:id,name,avatar_url`, `labels` and the checklist counts.
 */
final class TaskListRow
{
    /** Due-date group hints, in display order. */
    public const array GROUPS = ['terlambat', 'hari-ini', 'minggu-ini', 'nanti', 'tanpa-tenggat', 'selesai'];

    /**
     * @return array<string, mixed>
     */
    public static function make(Task $task, CarbonImmutable $today, ?TaskPlan $plan = null): array
    {
        $attributes = $task->getAttributes();
        $total = (int) ($attributes['checklist_items_count'] ?? 0);
        $due = $task->due_date?->toDateString();
        $closed = $task->isClosed();
        $workspace = $task->workspace;

        return [
            ...TaskSummary::make($task),
            'number' => $task->number,
            'workspace' => [
                'id' => $workspace->id,
                'key' => $workspace->key,
                'name' => $workspace->name,
                'type' => $workspace->type->value,
            ],
            'start_date' => $task->start_date?->toDateString(),
            'completed_at' => $task->completed_at?->toIso8601String(),
            'assignee_people' => $task->assignees->map(fn (User $user): array => PersonResource::from($user))->values()->all(),
            'labels' => $task->relationLoaded('labels')
                ? $task->labels->map(fn (Label $label): array => ['id' => $label->id, 'name' => $label->name, 'color' => $label->color])->values()->all()
                : [],
            'checklist' => $total > 0 ? ['done' => (int) ($attributes['checklist_done_count'] ?? 0), 'total' => $total] : null,
            'days_late' => $due !== null && ! $closed && $due < $today->toDateString()
                ? (int) round(CarbonImmutable::parse($due, 'UTC')->diffInDays(CarbonImmutable::parse($today->toDateString(), 'UTC')))
                : 0,
            'group' => self::group($task, $today),
            // The viewer's own planner lane (task_plans): `bucket` is what they
            // chose (null = automatic), `lane` is where "Rencana saya" shows it.
            'plan' => [
                'bucket' => $plan?->bucket?->value,
                'lane' => ($plan->bucket ?? LanePlacement::auto($task->due_date, $today))->value,
            ],
        ];
    }

    /**
     * Due-date bucket of a task for grouping ("Tenggat" grouping of Tugas saya).
     */
    public static function group(Task $task, CarbonImmutable $today): string
    {
        if ($task->isClosed()) {
            return 'selesai';
        }

        if ($task->due_date === null) {
            return 'tanpa-tenggat';
        }

        $due = $task->due_date->toDateString();

        return match (true) {
            $due < $today->toDateString() => 'terlambat',
            $due === $today->toDateString() => 'hari-ini',
            $due <= LanePlacement::weekEnd($today)->toDateString() => 'minggu-ini',
            default => 'nanti',
        };
    }
}
