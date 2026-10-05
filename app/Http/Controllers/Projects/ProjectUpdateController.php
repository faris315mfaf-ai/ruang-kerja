<?php

namespace App\Http\Controllers\Projects;

use App\Domain\Projects\Actions\PostProjectUpdate;
use App\Domain\Projects\Actions\ResolveProjectDecision;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectUpdateRequest;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * "Update proyek" (PIC/admin) and "Tandai keputusan selesai" (Direksi).
 */
class ProjectUpdateController extends Controller
{
    public function store(ProjectUpdateRequest $request, Workspace $workspace, #[CurrentUser] User $user, PostProjectUpdate $action): RedirectResponse
    {
        Gate::authorize('create', [ProjectUpdate::class, $workspace]);

        $action->handle($workspace, $user, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Update proyek terkirim.']);

        return back();
    }

    public function resolveDecision(Workspace $workspace, ProjectUpdate $projectUpdate, #[CurrentUser] User $user, ResolveProjectDecision $action): RedirectResponse
    {
        Gate::authorize('resolveDecision', $projectUpdate);

        $action->handle($projectUpdate, $user);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Keputusan ditandai selesai.']);

        return back();
    }
}
