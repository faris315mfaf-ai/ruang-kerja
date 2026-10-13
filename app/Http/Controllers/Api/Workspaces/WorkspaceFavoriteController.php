<?php

namespace App\Http\Controllers\Api\Workspaces;

use App\Domain\Workspaces\Actions\ToggleWorkspaceFavorite;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * POST / DELETE /api/v1/workspace/{workspace}/favorit — star or unstar for
 * the caller (WorkspacePolicy::favorite: members only; the web
 * ToggleWorkspaceFavorite action). Idempotent.
 */
class WorkspaceFavoriteController extends Controller
{
    public function store(Workspace $workspace, #[CurrentUser] User $user, ToggleWorkspaceFavorite $toggle): JsonResponse
    {
        Gate::authorize('favorite', $workspace);
        $toggle->handle($workspace, $user, true);

        return response()->json(['favorit' => true]);
    }

    public function destroy(Workspace $workspace, #[CurrentUser] User $user, ToggleWorkspaceFavorite $toggle): JsonResponse
    {
        Gate::authorize('favorite', $workspace);
        $toggle->handle($workspace, $user, false);

        return response()->json(['favorit' => false]);
    }
}
