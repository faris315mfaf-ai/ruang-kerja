<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Services\Lexorank;
use App\Events\Tasks\TaskUpdated;
use App\Models\ChecklistItem;
use App\Models\Task;
use Illuminate\Support\Facades\DB;

/**
 * Appends a checklist line at the bottom (lexorank after the last line; the
 * task row is locked so concurrent additions get distinct positions).
 */
final class AddChecklistItem
{
    public function handle(Task $task, string $title): ChecklistItem
    {
        $item = DB::transaction(function () use ($task, $title): ChecklistItem {
            Task::query()->whereKey($task->id)->lockForUpdate()->first(['id']);

            $last = ChecklistItem::query()->where('task_id', $task->id)->orderByDesc('position')->value('position');
            $position = is_string($last) && strlen($last) < Lexorank::MAX_LENGTH
                ? Lexorank::between($last, null)
                : self::rebalanced($task);

            return ChecklistItem::query()->create([
                'task_id' => $task->id,
                'title' => trim($title),
                'position' => $position,
            ]);
        });

        $task->touch();
        TaskUpdated::dispatch($task);

        return $item;
    }

    /**
     * Rewrites the positions evenly and returns a key after the last one.
     */
    private static function rebalanced(Task $task): string
    {
        $ids = ChecklistItem::query()->where('task_id', $task->id)->orderBy('position')->pluck('id')->all();
        $keys = Lexorank::sequence(count($ids) + 1);

        foreach ($ids as $index => $id) {
            ChecklistItem::query()->whereKey($id)->update(['position' => $keys[$index]]);
        }

        return $keys[count($ids)];
    }
}
