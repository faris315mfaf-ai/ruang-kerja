<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Tasks\Actions\AddChecklistItem;
use App\Domain\Tasks\Actions\DeleteChecklistItem;
use App\Domain\Tasks\Actions\UpdateChecklistItem;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tasks\ChecklistItemRequest;
use App\Models\ChecklistItem;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Checklist lines of a task (JSON API of the task detail).
 */
class ChecklistController extends Controller
{
    public function store(ChecklistItemRequest $request, Task $task, AddChecklistItem $add): JsonResponse
    {
        Gate::authorize('update', $task);

        $item = $add->handle($task, $request->string('title')->toString());

        return response()->json(['item' => self::present($item)], 201);
    }

    public function update(ChecklistItemRequest $request, ChecklistItem $item, #[CurrentUser] User $user, UpdateChecklistItem $update): JsonResponse
    {
        Gate::authorize('update', $item);

        $item = $update->handle($item, $user, $request->changes());

        return response()->json(['item' => self::present($item)]);
    }

    public function destroy(ChecklistItem $item, DeleteChecklistItem $delete): JsonResponse
    {
        Gate::authorize('delete', $item);

        $delete->handle($item);

        return response()->json(status: 204);
    }

    /**
     * @return array<string, mixed>
     */
    private static function present(ChecklistItem $item): array
    {
        return [
            'id' => $item->id,
            'title' => $item->title,
            'is_done' => $item->is_done,
            'position' => $item->position,
            'done_by' => $item->done_by,
            'done_at' => $item->done_at?->toIso8601String(),
        ];
    }
}
