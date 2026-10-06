<?php

namespace App\Http\Controllers\RoleDashboards;

use App\Domain\Projects\Actions\RequestProjectUpdate;
use App\Domain\RoleDashboards\Actions\DecideProjectFromDashboard;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\RequestProjectUpdateRequest;
use App\Http\Requests\RoleDashboards\ResolveRoleDecisionRequest;
use App\Models\ProjectDirection;
use App\Models\ProjectUpdate;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Dirut decision flow on the job dashboard: "Putuskan" (direction +
 * ResolveProjectDecision) and "Minta update" (RequestProjectUpdate), with
 * the project policies of the portfolio.
 */
class RoleDecisionController extends Controller
{
    public function resolve(ResolveRoleDecisionRequest $request, #[CurrentUser] User $user, DashboardRole $role, ProjectUpdate $projectUpdate, DecideProjectFromDashboard $action): RedirectResponse
    {
        $this->authorizeFlow($role);
        Gate::authorize('resolveDecision', $projectUpdate);

        if ($request->decision() !== null) {
            Gate::authorize('create', [ProjectDirection::class, $projectUpdate->workspace]);
        }

        $action->handle($projectUpdate, $user, $request->decision());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Keputusan {$projectUpdate->workspace->key} dicatat. PIC diberi tahu."]);

        return back();
    }

    public function requestUpdate(RequestProjectUpdateRequest $request, #[CurrentUser] User $user, DashboardRole $role, ProjectUpdate $projectUpdate, RequestProjectUpdate $action): RedirectResponse
    {
        $this->authorizeFlow($role);
        Gate::authorize('steerProject', $projectUpdate->workspace);

        $recipient = $action->handle($projectUpdate->workspace, $user, $request->note());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Permintaan update dikirim ke {$recipient->name}."]);

        return back();
    }

    private function authorizeFlow(DashboardRole $role): void
    {
        Gate::authorize('viewRoleDashboard', $role);
        abort_unless($role === DashboardRole::Dirut, 404);
    }
}
