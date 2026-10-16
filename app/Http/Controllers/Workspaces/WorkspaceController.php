<?php

namespace App\Http\Controllers\Workspaces;

use App\Domain\Hiring\Queries\HiringOverview;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Actions\CreateWorkspace;
use App\Domain\Workspaces\Actions\UpdateWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceGroup;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Domain\Workspaces\Queries\LinkableTeams;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspaces\StoreWorkspaceRequest;
use App\Http\Requests\Workspaces\UpdateWorkspaceRequest;
use App\Http\Resources\WorkspaceResource;
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
            'teams' => fn (): array => app(LinkableTeams::class)->for($user),
            // The Hiring space as a special card (null without access; docs/fitur/hiring.md).
            'hiring' => fn (): ?array => app(HiringOverview::class)->card($user),
        ]);
    }

    public function store(StoreWorkspaceRequest $request, #[CurrentUser] User $user, CreateWorkspace $createWorkspace): RedirectResponse
    {
        $payload = $request->payload();

        Gate::authorize('create', [Workspace::class, $payload['type']]);

        if ($payload['team_id'] !== null && ! in_array($payload['team_id'], array_column(app(LinkableTeams::class)->for($user), 'id'), true)) {
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
}
