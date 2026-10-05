<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Workspaces\Actions\ToggleWorkspaceFavorite;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Star / unstar a workspace in the sidebar.
 */
class WorkspaceFavoriteController extends Controller
{
    public function store(Workspace $workspace, #[CurrentUser] User $user, ToggleWorkspaceFavorite $toggle): RedirectResponse
    {
        Gate::authorize('favorite', $workspace);
        $toggle->handle($workspace, $user, true);

        return back();
    }

    public function destroy(Workspace $workspace, #[CurrentUser] User $user, ToggleWorkspaceFavorite $toggle): RedirectResponse
    {
        Gate::authorize('favorite', $workspace);
        $toggle->handle($workspace, $user, false);

        return back();
    }
}
