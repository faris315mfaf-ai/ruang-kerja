<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Workspaces\Support\ActivityText;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/workspace/{workspace}/aktivitas — the "Aktivitas" feed, newest
 * first, 30 per page (?page=). Each row carries the Indonesian sentence the
 * web feed builds on the client (ActivityText = port of activity-text.ts), so
 * the app does not need the event vocabulary. Visible to everyone who can see
 * the workspace, like the web tab.
 */
class WorkspaceActivityController extends Controller
{
    public const int PER_PAGE = 30;

    public function __invoke(Workspace $workspace, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $workspace);

        $page = Activity::query()
            ->where('workspace_id', $workspace->id)
            ->respectingPrivacyOf($user)
            ->with('causer:id,name,avatar_url')
            ->latest('created_at')
            ->latest('id')
            ->paginate(self::PER_PAGE);

        $userIds = [];
        foreach ($page->items() as $activity) {
            array_push($userIds, ...ActivityText::userIds($activity->properties ?? []));
        }

        /** @var array<string, string> $names */
        $names = $userIds === []
            ? []
            : User::query()->whereIn('id', array_values(array_unique($userIds)))->pluck('name', 'id')->all();

        $taskType = (new Task)->getMorphClass();

        return response()->json([
            'aktivitas' => array_map(fn (Activity $activity): array => [
                'id' => $activity->id,
                'event' => $activity->event,
                'text' => ActivityText::describe($activity->event, $activity->properties ?? [], $names),
                'subject_type' => $activity->subject_type === $taskType ? 'task' : 'workspace',
                'subject_id' => $activity->subject_id,
                'task_key' => is_string($activity->properties['key'] ?? null) ? $activity->properties['key'] : null,
                'created_at' => $activity->created_at->toIso8601String(),
                'actor' => $activity->causer === null ? null : [
                    'id' => $activity->causer->id,
                    'name' => $activity->causer->name,
                    'avatar' => $activity->causer->avatar_url,
                ],
            ], $page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'has_more' => $page->hasMorePages(),
            ],
        ]);
    }
}
