<?php

namespace Database\Factories;

use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Bypasses CreateTask (no activities/events) but keeps numbering and the
 * denormalized status category consistent. Tests of the real flow use the action.
 *
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'number' => fn (array $attributes): int => self::nextNumber((string) $attributes['workspace_id']),
            'title' => ucfirst(fake()->words(4, true)),
            'status_id' => fn (array $attributes): string => self::defaultStatus((string) $attributes['workspace_id'])->id,
            'status_category' => fn (array $attributes): TaskStatusCategory => self::status((string) $attributes['status_id'])->category,
            'priority' => TaskPriority::None,
            'position' => fn (): string => 'V'.strtoupper(fake()->unique()->lexify('????')),
        ];
    }

    public function inStatus(TaskStatus $status): static
    {
        return $this->state(fn (): array => [
            'workspace_id' => $status->workspace_id,
            'status_id' => $status->id,
            'status_category' => $status->category,
        ]);
    }

    public function due(?string $date): static
    {
        return $this->state(fn (): array => ['due_date' => $date]);
    }

    private static function nextNumber(string $workspaceId): int
    {
        $row = DB::selectOne('UPDATE workspaces SET task_sequence = task_sequence + 1 WHERE id = ? RETURNING task_sequence', [$workspaceId]);

        if (! is_object($row) || ! isset($row->task_sequence)) {
            throw new RuntimeException("Workspace [{$workspaceId}] not found.");
        }

        return (int) $row->task_sequence;
    }

    private static function defaultStatus(string $workspaceId): TaskStatus
    {
        return TaskStatus::query()->where('workspace_id', $workspaceId)->orderBy('position')->first()
            ?? TaskStatus::factory()->create(['workspace_id' => $workspaceId]);
    }

    private static function status(string $statusId): TaskStatus
    {
        return TaskStatus::query()->findOrFail($statusId);
    }
}
