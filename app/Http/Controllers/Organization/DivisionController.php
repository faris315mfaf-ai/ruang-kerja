<?php

namespace App\Http\Controllers\Organization;

use App\Domain\Organization\Actions\DeleteDivision;
use App\Domain\Organization\Actions\RestoreDivision;
use App\Domain\Organization\Actions\SaveDivision;
use App\Domain\Organization\Enums\UserStatus;
use App\Http\Requests\Organization\DivisionRequest;
use App\Models\Division;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class DivisionController extends OrganizationAdminController
{
    public function index(Request $request, #[CurrentUser] User $actor): Response
    {
        // Admin pages are for those who manage org units (HR, Super Admin).
        Gate::authorize('create', Division::class);

        $divisions = Division::query()->visibleTo($actor)
            ->when($this->showDeleted($request), fn (Builder $query) => $query->withTrashed())
            ->with([
                'parent' => fn ($query) => $query->withTrashed()->select(['id', 'name']),
                'head:id,name,avatar_url',
            ])
            ->withCount([
                'members as members_count' => fn (Builder $query) => $query->where('status', UserStatus::Active->value),
                'teams',
                'children',
            ])
            ->orderByDesc('is_board')
            ->orderBy('name')
            ->get();

        return $this->page($request, $actor, 'divisi', [
            'divisions' => $divisions->map(fn (Division $division): array => [
                'id' => $division->id,
                'name' => $division->name,
                'code' => $division->code,
                'isBoard' => $division->is_board,
                'parentId' => $division->parent_id,
                'parentName' => $division->parent?->name,
                'head' => $this->personRef($division->head),
                'membersCount' => (int) $division->getAttribute('members_count'),
                'teamsCount' => (int) $division->getAttribute('teams_count'),
                'childrenCount' => (int) $division->getAttribute('children_count'),
                'deletedAt' => $division->deleted_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    public function store(DivisionRequest $request, #[CurrentUser] User $actor, SaveDivision $save): RedirectResponse
    {
        Gate::authorize('create', Division::class);

        $division = $save->handle($actor, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Divisi {$division->name} ditambahkan."]);

        return back();
    }

    public function update(DivisionRequest $request, Division $division, #[CurrentUser] User $actor, SaveDivision $save): RedirectResponse
    {
        Gate::authorize('update', $division);

        $save->handle($actor, $request->payload(), $division);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Divisi {$division->name} disimpan."]);

        return back();
    }

    public function destroy(Division $division, DeleteDivision $delete): RedirectResponse
    {
        Gate::authorize('delete', $division);

        $delete->handle($division);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Divisi {$division->name} dihapus."]);

        return back();
    }

    public function restore(Division $division, RestoreDivision $restore): RedirectResponse
    {
        Gate::authorize('restore', $division);

        $restore->handle($division);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Divisi {$division->name} dipulihkan."]);

        return back();
    }
}
