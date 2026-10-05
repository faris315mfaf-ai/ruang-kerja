<?php

namespace App\Http\Controllers\Projects;

use App\Domain\Projects\Actions\DeleteMilestone;
use App\Domain\Projects\Actions\SaveMilestone;
use App\Domain\Projects\Actions\SetMilestoneCompletion;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\MilestoneRequest;
use App\Models\Milestone;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Milestone CRUD (PIC / workspace admin).
 */
class MilestoneController extends Controller
{
    public function store(MilestoneRequest $request, Workspace $workspace, #[CurrentUser] User $user, SaveMilestone $action): RedirectResponse
    {
        Gate::authorize('create', [Milestone::class, $workspace]);

        $action->handle($workspace, $user, $request->payload());

        return $this->done('Milestone ditambahkan.');
    }

    public function update(MilestoneRequest $request, Workspace $workspace, Milestone $milestone, #[CurrentUser] User $user, SaveMilestone $action): RedirectResponse
    {
        Gate::authorize('update', $milestone);

        $action->handle($workspace, $user, $request->payload(), $milestone);

        return $this->done('Milestone disimpan.');
    }

    public function complete(Request $request, Workspace $workspace, Milestone $milestone, #[CurrentUser] User $user, SetMilestoneCompletion $action): RedirectResponse
    {
        Gate::authorize('update', $milestone);

        $request->validate(['completed' => ['required', 'boolean']]);
        $completed = $request->boolean('completed');

        $action->handle($milestone, $user, $completed);

        return $this->done($completed ? 'Milestone ditandai selesai.' : 'Milestone dibuka kembali.');
    }

    public function destroy(Workspace $workspace, Milestone $milestone, #[CurrentUser] User $user, DeleteMilestone $action): RedirectResponse
    {
        Gate::authorize('delete', $milestone);

        $action->handle($milestone, $user);

        return $this->done('Milestone dihapus.');
    }

    private function done(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
