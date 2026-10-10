<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Workspaces\Queries\WorkspacePage;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/workspace/{workspace}/anggota — for the task form's assignee
 * picker; same visibility rule as the web workspace page.
 */
class WorkspaceMemberController extends Controller
{
    public function __invoke(Workspace $workspace, #[CurrentUser] User $user, WorkspacePage $page): JsonResponse
    {
        Gate::authorize('view', $workspace);

        return response()->json(['anggota' => $page->members($workspace)]);
    }
}
