<?php

namespace App\Http\Controllers\RoleDashboards;

use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Domain\RoleDashboards\Queries\RoleDashboardPresenter;
use App\Domain\RoleDashboards\Queries\UnitRoleDashboard;
use App\Domain\RoleDashboards\Services\RoleDashboardAccess;
use App\Http\Controllers\Controller;
use App\Models\Division;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dashboard per jabatan (F3, docs/fitur/dashboard-peran.md): `/peran` opens
 * the job dashboard of the viewer's own position, `/peran/{role}` one job
 * (Gate `viewRoleDashboard`; no access = 404). The dashboard body is a
 * deferred prop (skeleton first, metric blocks cached 5 minutes under the
 * "peran" view); the task flow is a live closure the page reloads alone.
 */
class RoleDashboardController extends Controller
{
    public function __construct(
        private readonly RoleDashboardAccess $access,
        private readonly RoleDashboardPresenter $presenter,
        private readonly UnitRoleDashboard $units,
    ) {}

    public function index(#[CurrentUser] User $user): RedirectResponse
    {
        $role = $this->access->landing($user);
        abort_if($role === null, 404);

        return to_route('roles.show', ['role' => $role->value]);
    }

    public function show(Request $request, #[CurrentUser] User $user, DashboardRole $role): Response
    {
        Gate::authorize('viewRoleDashboard', $role);

        $now = CarbonImmutable::now();
        $divisions = $role->isUnit() ? $this->units->divisions($user) : new Collection;
        $requested = $request->query('divisi');
        $division = $role->isUnit() ? $this->units->resolveDivision($user, $role, $divisions, is_string($requested) ? $requested : null) : null;
        $selected = $request->query('pilih');
        $presenter = $this->presenter;

        return Inertia::render('roles/show', [
            'role' => $role->value,
            'roles' => array_map(fn (DashboardRole $item): array => [
                'value' => $item->value,
                'label' => $item->label(),
                'short' => $item->shortLabel(),
            ], $this->access->roles($user)),
            'divisions' => $divisions->count() > 1
                ? array_values($divisions->map(fn (Division $item): array => ['value' => $item->id, 'label' => $item->name])->all())
                : [],
            'division' => $division?->id,
            'dashboard' => Inertia::defer(fn (): array => $presenter->dashboard($user, $role, $divisions, $division, $now)),
            'flow' => fn (): ?array => $presenter->flow($user, $role, is_string($selected) ? $selected : null),
        ]);
    }
}
