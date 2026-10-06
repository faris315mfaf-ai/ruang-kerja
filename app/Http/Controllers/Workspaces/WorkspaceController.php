<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Actions\UpdateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceGroup;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspaces\StoreWorkspaceRequest;
use App\Http\Requests\Workspaces\UpdateWorkspaceRequest;
use App\Http\Resources\WorkspaceResource;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Workspace directory (/workspace), creation and general settings.
 */
class WorkspaceController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user): Response
    {
        Gate::authorize('viewAny', Workspace::class);

        $workspaces = Workspace::query()
            ->visibleTo($user)
            ->withMembershipOf($user)
            ->withCount([
                'memberships as members_count',
                'tasks as open_tasks_count' => fn (Builder $query) => $query->whereNotIn('status_category', TaskStatusCategory::closedValues()),
            ])
            ->orderBy('name')
            ->get();

        return Inertia::render('workspaces/index', [
            'workspaces' => $workspaces
                ->sortBy(fn (Workspace $workspace): string => $workspace->type->sortOrder().mb_strtolower($workspace->name))
                ->map(fn (Workspace $workspace): array => [
                    ...(new WorkspaceResource($workspace))->resolve(),
                    'open_tasks_count' => (int) ($workspace->getAttribute('open_tasks_count') ?? 0),
                    'is_member' => $workspace->membership !== null,
                    // Role pill on the card (SProyekSaya "PIC · Anggota · Pemilik").
                    'my_role' => $workspace->membership?->role->value,
                    // Pribadi · Divisi & tim · Proyek · Lainnya (keputusan pemilik 6 Okt 2026).
                    'group' => WorkspaceGroup::of($workspace->type, $workspace->membership !== null || $workspace->type === WorkspaceType::Personal)->value,
                ])
                ->values()
                ->all(),
            // Chip filter `?jenis=` (null = Semua); the client filters the list.
            'filter' => WorkspaceGroup::fromQuery($request->query('jenis'))?->value,
            'can_create' => [
                'team' => Gate::allows('create', [Workspace::class, WorkspaceType::Team]),
                'project' => Gate::allows('create', [Workspace::class, WorkspaceType::Project]),
            ],
            'teams' => fn (): array => $this->linkableTeams($user),
        ]);
    }

    public function store(StoreWorkspaceRequest $request, #[CurrentUser] User $user, CreateWorkspace $createWorkspace): RedirectResponse
    {
        $payload = $request->payload();

        Gate::authorize('create', [Workspace::class, $payload['type']]);

        if ($payload['team_id'] !== null && ! in_array($payload['team_id'], array_column($this->linkableTeams($user), 'id'), true)) {
            $payload['team_id'] = null;
        }

        $workspace = $createWorkspace->handle($user, $payload);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Workspace {$workspace->name} dibuat."]);

        return to_route('workspaces.show', $workspace);
    }

    public function update(UpdateWorkspaceRequest $request, Workspace $workspace, #[CurrentUser] User $user, UpdateWorkspace $updateWorkspace): RedirectResponse
    {
        Gate::authorize('update', $workspace);

        $updateWorkspace->handle($workspace, $user, $request->changes());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Perubahan disimpan.']);

        return to_route('workspaces.settings', $workspace);
    }

    /**
     * Teams a team workspace may be linked to (member sync): Super Admin → all,
     * Kepala Divisi → teams of the divisions they lead, Ketua Tim → own teams.
     *
     * @return list<array{id: string, name: string}>
     */
    private function linkableTeams(User $user): array
    {
        $query = Team::query()->visibleTo($user)->orderBy('name');

        if (! $user->hasPermission(Permission::WorkspacesManage)) {
            $divisionIds = $user->hasRole(Role::KepalaDivisi) ? $user->ledDivisionIds() : [];

            $query->where(fn (Builder $scope) => $scope
                ->where('lead_user_id', $user->id)
                ->when($divisionIds !== [], fn (Builder $led) => $led->orWhereIn('division_id', $divisionIds)));
        }

        return array_values($query->get(['id', 'name'])
            ->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name])
            ->all());
    }
}
