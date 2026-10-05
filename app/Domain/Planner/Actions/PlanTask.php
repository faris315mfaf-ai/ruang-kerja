<?php

namespace App\Domain\Planner\Actions;

use App\Domain\Analytics\Data\Period;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Puts a task in one of the user's lanes ("Hari ini" / "Minggu ini" /
 * "Nanti"), below $afterId or above $beforeId (task ids of planned
 * neighbours; unknown or automatic neighbours are ignored → end of the
 * planned part of the lane). Also accepts a newly assigned task (seen_at).
 * Never changes the task itself.
 */
final class PlanTask
{
    public function handle(User $user, Task $task, PlanBucket $bucket, ?string $afterId = null, ?string $beforeId = null): TaskPlan
    {
        return DB::transaction(function () use ($user, $task, $bucket, $afterId, $beforeId): TaskPlan {
            $now = now()->toImmutable();

            // Serializes concurrent writers of this lane (two tabs dragging at once).
            /** @var Collection<int, TaskPlan> $lane */
            $lane = TaskPlan::query()
                ->ownedBy($user)
                ->where('bucket', $bucket->value)
                ->where('task_id', '!=', $task->id)
                ->orderBy('position')
                ->orderBy('id')
                ->lockForUpdate()
                ->get(['id', 'task_id', 'position']);

            $plan = TaskPlan::query()->ownedBy($user)->where('task_id', $task->id)->lockForUpdate()->first()
                ?? new TaskPlan(['user_id' => $user->id, 'task_id' => $task->id]);

            // Reordering inside the same lane keeps the day it was planned ("terbawa").
            if ($plan->bucket !== $bucket || $plan->planned_for === null) {
                $plan->planned_for = Period::officeDate($now);
            }

            $plan->bucket = $bucket;
            $plan->position = $this->position($lane, $this->insertAt($lane, $afterId, $beforeId));
            $plan->seen_at ??= $now;
            $plan->save();

            return $plan;
        });
    }

    /**
     * @param  Collection<int, TaskPlan>  $lane
     */
    private function insertAt(Collection $lane, ?string $afterId, ?string $beforeId): int
    {
        $after = $afterId !== null ? $lane->search(fn (TaskPlan $plan): bool => $plan->task_id === $afterId) : false;

        if (is_int($after)) {
            return $after + 1;
        }

        $before = $beforeId !== null ? $lane->search(fn (TaskPlan $plan): bool => $plan->task_id === $beforeId) : false;

        return is_int($before) ? $before : $lane->count();
    }

    /**
     * Key between the neighbours at $index; rewrites the lane with evenly
     * spaced keys when they collide or the key grows too long.
     *
     * @param  Collection<int, TaskPlan>  $lane
     */
    private function position(Collection $lane, int $index): string
    {
        $low = $lane->get($index - 1)?->position;
        $high = $lane->get($index)?->position;
        $usable = ($low === null || Lexorank::isValid($low))
            && ($high === null || Lexorank::isValid($high))
            && ($low === null || $high === null || strcmp($low, $high) < 0);

        if ($usable) {
            $key = Lexorank::between($low, $high);

            if (strlen($key) <= Lexorank::MAX_LENGTH) {
                return $key;
            }
        }

        $keys = Lexorank::sequence($lane->count() + 1);

        foreach ($lane->values() as $offset => $neighbour) {
            $slot = $offset < $index ? $offset : $offset + 1;
            TaskPlan::query()->whereKey($neighbour->id)->update(['position' => $keys[$slot]]);
        }

        return $keys[$index];
    }
}
