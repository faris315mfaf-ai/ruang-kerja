<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Events\Tasks\TaskUpdated;
use App\Models\ChecklistItem;
use App\Models\Task;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Reorders a checklist line (mobile "geser untuk urut ulang"): puts it right
 * below $afterId or right above $beforeId (ids of lines of the same task;
 * unknown ids are ignored → the line goes to the end). Same lexorank scheme
 * as AddChecklistItem; the task row is locked so two devices reordering at
 * once get consistent positions. Authorize first (ChecklistItemPolicy::update).
 */
final class MoveChecklistItem
{
    public function handle(ChecklistItem $item, ?string $afterId = null, ?string $beforeId = null): ChecklistItem
    {
        /** @var Task $task */
        $task = $item->task()->firstOrFail();

        DB::transaction(function () use ($item, $task, $afterId, $beforeId): void {
            Task::query()->whereKey($task->id)->lockForUpdate()->first(['id']);

            /** @var Collection<int, ChecklistItem> $siblings */
            $siblings = ChecklistItem::query()
                ->where('task_id', $task->id)
                ->where('id', '!=', $item->id)
                ->orderBy('position')
                ->orderBy('id')
                ->get(['id', 'position']);

            $index = $this->insertAt($siblings, $afterId, $beforeId);
            $item->position = $this->position($siblings, $index);
            $item->save();
        });

        $task->touch();
        TaskUpdated::dispatch($task);

        return $item;
    }

    /**
     * @param  Collection<int, ChecklistItem>  $siblings
     */
    private function insertAt(Collection $siblings, ?string $afterId, ?string $beforeId): int
    {
        $after = $afterId !== null ? $siblings->search(fn (ChecklistItem $line): bool => $line->id === $afterId) : false;

        if (is_int($after)) {
            return $after + 1;
        }

        $before = $beforeId !== null ? $siblings->search(fn (ChecklistItem $line): bool => $line->id === $beforeId) : false;

        return is_int($before) ? $before : $siblings->count();
    }

    /**
     * Key between the neighbours at $index; rewrites the siblings with evenly
     * spaced keys when they collide or the key would grow too long.
     *
     * @param  Collection<int, ChecklistItem>  $siblings
     */
    private function position(Collection $siblings, int $index): string
    {
        $low = $siblings->get($index - 1)?->position;
        $high = $siblings->get($index)?->position;
        $usable = ($low === null || Lexorank::isValid($low))
            && ($high === null || Lexorank::isValid($high))
            && ($low === null || $high === null || strcmp($low, $high) < 0);

        if ($usable) {
            $key = Lexorank::between($low, $high);

            if (strlen($key) <= Lexorank::MAX_LENGTH) {
                return $key;
            }
        }

        $keys = Lexorank::sequence($siblings->count() + 1);

        foreach ($siblings->values() as $offset => $line) {
            $slot = $offset < $index ? $offset : $offset + 1;
            ChecklistItem::query()->whereKey($line->id)->update(['position' => $keys[$slot]]);
        }

        return $keys[$index];
    }
}
