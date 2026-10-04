<?php

namespace App\Http\Controllers\Organization;

use App\Domain\Organization\Actions\DeletePosition;
use App\Domain\Organization\Actions\RestorePosition;
use App\Domain\Organization\Actions\SavePosition;
use App\Domain\Organization\Enums\PositionLevel;
use App\Domain\Organization\Enums\UserStatus;
use App\Http\Requests\Organization\PositionRequest;
use App\Models\Position;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PositionController extends OrganizationAdminController
{
    public function index(Request $request, #[CurrentUser] User $actor): Response
    {
        Gate::authorize('create', Position::class);

        $positions = Position::query()->visibleTo($actor)
            ->when($this->showDeleted($request), fn (Builder $query) => $query->withTrashed())
            ->withCount(['users as users_count' => fn (Builder $query) => $query->where('status', UserStatus::Active->value)])
            ->orderBy('level')
            ->orderBy('name')
            ->get();

        return $this->page($request, $actor, 'jabatan', [
            'positions' => $positions->map(fn (Position $position): array => [
                'id' => $position->id,
                'name' => $position->name,
                'level' => $position->level,
                'levelLabel' => PositionLevel::tryFrom($position->level)?->label() ?? (string) $position->level,
                'usersCount' => (int) $position->getAttribute('users_count'),
                'deletedAt' => $position->deleted_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    public function store(PositionRequest $request, #[CurrentUser] User $actor, SavePosition $save): RedirectResponse
    {
        Gate::authorize('create', Position::class);

        $position = $save->handle($actor, $request->payload());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Jabatan {$position->name} ditambahkan."]);

        return back();
    }

    public function update(PositionRequest $request, Position $position, #[CurrentUser] User $actor, SavePosition $save): RedirectResponse
    {
        Gate::authorize('update', $position);

        $save->handle($actor, $request->payload(), $position);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Jabatan {$position->name} disimpan."]);

        return back();
    }

    public function destroy(Position $position, DeletePosition $delete): RedirectResponse
    {
        Gate::authorize('delete', $position);

        $delete->handle($position);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Jabatan {$position->name} dihapus."]);

        return back();
    }

    public function restore(Position $position, RestorePosition $restore): RedirectResponse
    {
        Gate::authorize('restore', $position);

        $restore->handle($position);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Jabatan {$position->name} dipulihkan."]);

        return back();
    }
}
