<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Workspaces\Actions\ArchiveWorkspace;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Pengaturan › Zona bahaya: archive / restore.
 */
class WorkspaceArchiveController extends Controller
{
    public function store(Workspace $workspace, #[CurrentUser] User $user, ArchiveWorkspace $archive): RedirectResponse
    {
        Gate::authorize('archive', $workspace);

        $archive->handle($workspace, $user, true);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Workspace {$workspace->name} diarsipkan."]);

        return to_route('workspaces.settings', $workspace);
    }

    public function destroy(Workspace $workspace, #[CurrentUser] User $user, ArchiveWorkspace $archive): RedirectResponse
    {
        Gate::authorize('archive', $workspace);

        $archive->handle($workspace, $user, false);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Workspace {$workspace->name} dipulihkan."]);

        return to_route('workspaces.settings', $workspace);
    }
}
