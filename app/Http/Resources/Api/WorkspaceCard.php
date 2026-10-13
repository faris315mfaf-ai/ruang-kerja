<?php

namespace App\Http\Resources\Api;

use App\Http\Resources\TaskResource;
use App\Models\Task;
use App\Models\User;

/**
 * Task card of the workspace screens (board, list, calendar, move result):
 * the web TaskResource (ids, status category, priority, due date, checklist
 * counts, comment badge) plus the assignee names the card shows and the
 * `can` flags. Eager-load `assignees:id,name` (BoardTasks::query() loads
 * ids only, so the callers re-load the names with one query).
 *
 * `can.move` is a workspace-level right (WorkspacePolicy::editTasks) and is
 * the same for every card; editing a card depends on who assigned it, so the
 * app reads `can.edit` from GET /tugas/{id} instead of paying one query per
 * card here.
 */
final class WorkspaceCard
{
    /**
     * @return array<string, mixed>
     */
    public static function make(Task $task, bool $canMove): array
    {
        $card = (new TaskResource($task))->resolve();

        $card['assignees'] = $task->assignees
            ->map(fn (User $user): array => ['id' => $user->id, 'nama' => $user->name])
            ->values()
            ->all();
        $card['can'] = ['move' => $canMove];

        // List and calendar rows have no column to read it from.
        if ($task->relationLoaded('status')) {
            $card['status'] = [
                'id' => $task->status->id,
                'name' => $task->status->name,
                'kategori' => $task->status->category->value,
                'color' => $task->status->color,
            ];
        }

        return $card;
    }
}
