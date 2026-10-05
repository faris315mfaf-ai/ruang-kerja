<?php

namespace App\Http\Controllers\Projects;

use App\Domain\Projects\Actions\GiveProjectDirection;
use App\Domain\Projects\Actions\RequestProjectUpdate;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\ProjectDirectionRequest;
use App\Http\Requests\Projects\RequestProjectUpdateRequest;
use App\Models\ProjectDirection;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Direksi actions: "Minta update" and "Beri arahan".
 */
class ProjectSteeringController extends Controller
{
    public function requestUpdate(RequestProjectUpdateRequest $request, Workspace $workspace, #[CurrentUser] User $user, RequestProjectUpdate $action): RedirectResponse
    {
        Gate::authorize('steerProject', $workspace);

        $recipient = $action->handle($workspace, $user, $request->note());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Permintaan update dikirim ke {$recipient->name}."]);

        return back();
    }

    public function direct(ProjectDirectionRequest $request, Workspace $workspace, #[CurrentUser] User $user, GiveProjectDirection $action): RedirectResponse
    {
        Gate::authorize('create', [ProjectDirection::class, $workspace]);

        $updateId = $request->updateId();
        $update = $updateId !== null ? ProjectUpdate::query()->where('workspace_id', $workspace->id)->findOrFail($updateId) : null;

        $action->handle($workspace, $user, $request->body(), $update);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Arahan terkirim ke PIC.']);

        return back();
    }
}
