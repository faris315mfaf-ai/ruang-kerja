<?php

namespace App\Http\Controllers\Organization;

use App\Domain\Organization\Actions\DeleteTeam;
use App\Domain\Organization\Actions\RestoreTeam;
use App\Domain\Organization\Actions\SaveTeam;
use App\Domain\Organization\Enums\UserStatus;
use App\Http\Requests\Organization\TeamRequest;
use App\Models\Team;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends OrganizationAdminController
{
    public function index(Request $request, #[CurrentUser] User $actor): Response
    {
        Gate::authorize('create', Team::class);

        $teams = Team::query()->visibleTo($actor)
            ->when($this->showDeleted($request), fn (Builder $query) => $query->withTrashed())
            ->with(['division:id,name,code', 'lead:id,name,avatar_url'])
            ->withCount(['members as members_count' => fn (Builder $query) => $query->where('status', UserStatus::Active->value)])
            ->orderBy('name')
            ->get()
            ->sortBy(fn (Team $team): string => $team->division->name.'|'.$team->name)
            ->values();

        return $this->page($request, $actor, 'tim', [
            'teams' => $teams->map(fn (Team $team): array => [
                'id' => $team->id,
                'name' => $team->name,
                'code' => $team->code,
                'divisionId' => $team->division_id,
                'divisionName' => $team->division->name,
                'divisionCode' => $team->division->code,
                'lead' => $this->personRef($team->lead),
                'membersCount' => (int) $team->getAttribute('members_count'),
                'deletedAt' => $team->deleted_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    public function store(TeamRequest $request, SaveTeam $save): RedirectResponse
    {
        Gate::authorize('create', Team::class);

        $team = $save->handle($request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$team->name} ditambahkan."]);

        return back();
    }

    public function update(TeamRequest $request, Team $team, SaveTeam $save): RedirectResponse
    {
        Gate::authorize('update', $team);

        $team = $save->handle($request->payload(), $team);

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$team->name} disimpan."]);

        return back();
    }

    public function destroy(Team $team, DeleteTeam $delete): RedirectResponse
    {
        Gate::authorize('delete', $team);

        $delete->handle($team);

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$team->name} dihapus."]);

        return back();
    }

    public function restore(Team $team, RestoreTeam $restore): RedirectResponse
    {
        Gate::authorize('restore', $team);

        $restore->handle($team);

        Inertia::flash('toast', ['type' => 'success', 'message' => "{$team->name} dipulihkan."]);

        return back();
    }
}
