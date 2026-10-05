<?php

namespace App\Http\Controllers\Projects;

use App\Domain\Projects\Actions\DeleteProjectRisk;
use App\Domain\Projects\Actions\SaveProjectRisk;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectRiskRequest;
use App\Models\ProjectRisk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Risk CRUD (PIC / workspace admin).
 */
class ProjectRiskController extends Controller
{
    public function store(ProjectRiskRequest $request, Workspace $workspace, #[CurrentUser] User $user, SaveProjectRisk $action): RedirectResponse
    {
        Gate::authorize('create', [ProjectRisk::class, $workspace]);

        $action->handle($workspace, $user, $request->payload());

        return $this->done('Risiko ditambahkan.');
    }

    public function update(ProjectRiskRequest $request, Workspace $workspace, ProjectRisk $risk, #[CurrentUser] User $user, SaveProjectRisk $action): RedirectResponse
    {
        Gate::authorize('update', $risk);

        $action->handle($workspace, $user, $request->payload(), $risk);

        return $this->done('Risiko disimpan.');
    }

    public function destroy(Workspace $workspace, ProjectRisk $risk, #[CurrentUser] User $user, DeleteProjectRisk $action): RedirectResponse
    {
        Gate::authorize('delete', $risk);

        $action->handle($risk, $user);

        return $this->done('Risiko dihapus.');
    }

    private function done(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
