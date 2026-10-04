<?php

namespace App\Domain\Tasks\Services;

use App\Models\Task;
use App\Models\TaskStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Computes Lexorank positions inside one board column. Call lockColumn()
 * inside the surrounding transaction first so concurrent writers of the same
 * column are serialized (SELECT … FOR UPDATE on the task_statuses row).
 */
final class TaskPositioner
{
    public function lockColumn(TaskStatus $status): void
    {
        TaskStatus::query()->whereKey($status->id)->lockForUpdate()->value('id');
    }

    /**
     * Key at the top of the column.
     */
    public function top(TaskStatus $status, ?string $exceptTaskId = null): string
    {
        $first = $this->ordered($status, $exceptTaskId)->first();

        return $this->keyBetween($status, $exceptTaskId, null, $first);
    }

    /**
     * Key directly below the task $afterId and/or above $beforeId. The client's
     * view may be stale, so the neighbours are re-read from the database:
     * $afterId wins when both are given, missing ids are ignored, and with no
     * usable neighbour the task goes to the top of the column.
     */
    public function between(TaskStatus $status, string $taskId, ?string $afterId, ?string $beforeId): string
    {
        $after = $afterId !== null ? $this->find($status, $taskId, $afterId) : null;
        $before = $beforeId !== null ? $this->find($status, $taskId, $beforeId) : null;

        if ($after !== null) {
            $before = $this->successor($status, $taskId, $after);
        } elseif ($before !== null) {
            $after = $this->predecessor($status, $taskId, $before);
        } else {
            return $this->top($status, $taskId);
        }

        return $this->keyBetween($status, $taskId, $after, $before);
    }

    /**
     * Rewrites the column with evenly spaced keys (keeps the current order).
     */
    public function rebalance(TaskStatus $status, ?string $exceptTaskId = null): void
    {
        $ids = $this->ordered($status, $exceptTaskId)->pluck('id')->all();
        $keys = Lexorank::sequence(count($ids));

        if ($ids === []) {
            return;
        }

        $values = [];
        $bindings = [];

        foreach ($ids as $index => $id) {
            $values[] = '(?, ?)';
            $bindings[] = $id;
            $bindings[] = $keys[$index];
        }

        DB::update(
            'UPDATE tasks SET position = v.position FROM (VALUES '.implode(', ', $values).') AS v(id, position) WHERE tasks.id = v.id',
            $bindings,
        );
    }

    private function keyBetween(TaskStatus $status, ?string $exceptTaskId, ?Task $after, ?Task $before): string
    {
        $low = $after?->position;
        $high = $before?->position;

        $usable = ($low === null || Lexorank::isValid($low))
            && ($high === null || Lexorank::isValid($high))
            && ($low === null || $high === null || strcmp($low, $high) < 0);

        if ($usable) {
            $key = Lexorank::between($low, $high);

            if (strlen($key) <= Lexorank::MAX_LENGTH) {
                return $key;
            }
        }

        // Keys collided (concurrent writers) or grew too long: spread the column out.
        $this->rebalance($status, $exceptTaskId);

        return Lexorank::between($after?->refresh()->position, $before?->refresh()->position);
    }

    /**
     * @return Builder<Task>
     */
    private function ordered(TaskStatus $status, ?string $exceptTaskId): Builder
    {
        return Task::query()
            ->where('status_id', $status->id)
            ->when($exceptTaskId !== null, fn (Builder $query) => $query->whereKeyNot($exceptTaskId))
            ->orderBy('position')
            ->orderBy('number');
    }

    private function find(TaskStatus $status, string $taskId, string $neighbourId): ?Task
    {
        if ($neighbourId === $taskId) {
            return null;
        }

        return Task::query()->where('status_id', $status->id)->whereKey($neighbourId)->first();
    }

    private function successor(TaskStatus $status, string $taskId, Task $after): ?Task
    {
        return $this->ordered($status, $taskId)
            ->where(fn (Builder $query) => $query
                ->where('position', '>', $after->position)
                ->orWhere(fn (Builder $tie) => $tie->where('position', $after->position)->where('number', '>', $after->number)))
            ->first();
    }

    private function predecessor(TaskStatus $status, string $taskId, Task $before): ?Task
    {
        return Task::query()
            ->where('status_id', $status->id)
            ->whereKeyNot($taskId)
            ->where(fn (Builder $query) => $query
                ->where('position', '<', $before->position)
                ->orWhere(fn (Builder $tie) => $tie->where('position', $before->position)->where('number', '<', $before->number)))
            ->orderByDesc('position')
            ->orderByDesc('number')
            ->first();
    }
}
