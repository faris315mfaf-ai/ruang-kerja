<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Actions\AddChecklistItem;
use App\Domain\Tasks\Actions\DeleteChecklistItem;
use App\Domain\Tasks\Actions\MoveChecklistItem;
use App\Domain\Tasks\Actions\UpdateChecklistItem;
use App\Domain\Tasks\Queries\TaskApiDetail;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\TaskChecklistRequest;
use App\Models\ChecklistItem;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Checklist of a task for the mobile app. Ticking, adding, renaming,
 * reordering and removing lines is doing the work (TaskPolicy::work /
 * ChecklistItemPolicy), so the assignee of a task someone else assigned may
 * do all of it. Every answer carries the whole refreshed list
 * (`items`) and the `{done, total}` counter, so the card never drifts.
 */
class TaskChecklistController extends Controller
{
    public function store(TaskChecklistRequest $request, Task $task, AddChecklistItem $add): JsonResponse
    {
        Gate::authorize('work', $task);

        $item = $add->handle($task, $request->string('title')->toString());

        return response()->json([...$this->snapshot($task), 'item' => TaskApiDetail::checklistItem($item)], 201);
    }

    public function update(TaskChecklistRequest $request, Task $task, ChecklistItem $item, #[CurrentUser] User $user, UpdateChecklistItem $update, MoveChecklistItem $move): JsonResponse
    {
        $this->belongs($task, $item);
        Gate::authorize('update', $item);

        $item = $update->handle($item, $user, $request->changes());

        if ($request->reorders()) {
            $item = $move->handle($item, $request->afterId(), $request->beforeId());
        }

        return response()->json([...$this->snapshot($task), 'item' => TaskApiDetail::checklistItem($item->refresh())]);
    }

    public function destroy(TaskChecklistRequest $request, Task $task, ChecklistItem $item, DeleteChecklistItem $delete): JsonResponse
    {
        $this->belongs($task, $item);
        Gate::authorize('delete', $item);

        $delete->handle($item);

        return response()->json([...$this->snapshot($task), 'removed' => true]);
    }

    /**
     * A line of another task is "not found" under this one.
     */
    private function belongs(Task $task, ChecklistItem $item): void
    {
        abort_unless($item->task_id === $task->id, 404);
    }

    /**
     * @return array{items: list<array<string, mixed>>, checklist: array{done: int, total: int}|null}
     */
    private function snapshot(Task $task): array
    {
        $items = ChecklistItem::query()->where('task_id', $task->id)->orderBy('position')->orderBy('id')->get();

        return [
            'items' => array_values($items->map(fn (ChecklistItem $line): array => TaskApiDetail::checklistItem($line))->all()),
            'checklist' => $items->isEmpty() ? null : ['done' => $items->where('is_done', true)->count(), 'total' => $items->count()],
        ];
    }
}
