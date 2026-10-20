<?php

namespace App\Http\Controllers\Tasks;

use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Http\Resources\LabelResource;
use App\Http\Resources\TaskStatusResource;
use App\Http\Resources\WorkspaceResource;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /tugas/opsi-form (JSON): workspaces where the user can create tasks,
 * with their columns, labels and members — for the quick-create dialog /
 * bottom sheet outside a workspace and its workspace switcher.
 */
class TaskFormOptionsController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, WorkspacePolicy $policy, WorkspacePage $page): JsonResponse
    {
        Gate::authorize('viewAny', Workspace::class);

        $workspaces = Workspace::query()
            ->joinedBy($user)
            ->notArchived()
            // Fixed number of queries: own role (policy) and members eager-loaded.
            ->withMembershipOf($user)
            ->with(['statuses', 'labels', 'memberships.user:id,name,avatar_url'])
            ->orderBy('name')
            ->get()
            ->filter(fn (Workspace $workspace): bool => $policy->canCreateTasks($user, $workspace))
            ->sortBy(fn (Workspace $workspace): string => $workspace->type->sortOrder().mb_strtolower($workspace->name))
            ->map(fn (Workspace $workspace): array => [
                ...WorkspaceResource::reference($workspace),
                'statuses' => TaskStatusResource::collection($workspace->statuses)->resolve(),
                'labels' => LabelResource::collection($workspace->labels)->resolve(),
                'members' => $page->members($workspace),
            ])
            ->values()
            ->all();

        return response()->json(['workspaces' => $workspaces]);
    }
}
