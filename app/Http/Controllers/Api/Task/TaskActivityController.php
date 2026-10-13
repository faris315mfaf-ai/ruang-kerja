<?php

namespace App\Http\Controllers\Api\Task;

use App\Domain\Tasks\Queries\TaskApiDetail;
use App\Domain\Tasks\Services\ActivityText;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Activity feed of one task (the append-only `activities` rows, newest
 * first), 30 per page, each with the Indonesian sentence the web feed shows.
 * `jenis` narrows to one group of events (status · penugasan · tenggat ·
 * prioritas · isi · checklist · lampiran). Needs `view` of the task.
 */
class TaskActivityController extends Controller
{
    public function index(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('view', $task);

        $data = $request->validate([
            'jenis' => ['sometimes', 'nullable', Rule::in(array_keys(ActivityText::GROUPS))],
            'per_page' => ['sometimes', 'integer', 'between:1,50'],
        ], ['jenis.in' => 'Jenis aktivitas tidak dikenal.']);

        $activities = Activity::query()
            ->where('subject_type', $task->getMorphClass())
            ->where('subject_id', $task->id)
            ->when(filled($data['jenis'] ?? null), fn ($query) => $query->whereIn('event', ActivityText::GROUPS[$data['jenis']]))
            ->with('causer:id,name,avatar_url')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($data['per_page'] ?? 30));

        return response()->json([
            'activities' => TaskApiDetail::activities(array_values($activities->items())),
            'meta' => [
                'current_page' => $activities->currentPage(),
                'from' => $activities->firstItem(),
                'last_page' => $activities->lastPage(),
                'per_page' => $activities->perPage(),
                'to' => $activities->lastItem(),
                'total' => $activities->total(),
            ],
        ]);
    }
}
