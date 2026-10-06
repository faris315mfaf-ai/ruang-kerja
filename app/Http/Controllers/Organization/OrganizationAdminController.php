<?php

namespace App\Http\Controllers\Organization;

use App\Domain\Organization\Enums\PositionLevel;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Http\Controllers\Controller;
use App\Models\Division;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Organisasi (desktop): one page component with three tabs
 * (divisi, tim, jabatan). Each tab controller renders its own list.
 */
abstract class OrganizationAdminController extends Controller
{
    /**
     * @param  'divisi'|'tim'|'jabatan'  $tab
     * @param  array<string, mixed>  $props
     */
    protected function page(Request $request, User $actor, string $tab, array $props): Response
    {
        return Inertia::render('admin/organization/index', [
            'tab' => $tab,
            'showDeleted' => $this->showDeleted($request),
            'counts' => [
                'divisions' => Division::query()->visibleTo($actor)->count(),
                'teams' => Team::query()->visibleTo($actor)->count(),
                'positions' => Position::query()->visibleTo($actor)->count(),
            ],
            'options' => fn (): array => [
                'divisions' => Division::query()->visibleTo($actor)
                    ->orderByDesc('is_board')->orderBy('name')
                    ->get(['id', 'name', 'code', 'is_board'])
                    ->map(fn (Division $division): array => [
                        'value' => $division->id,
                        'label' => $division->name,
                        'code' => $division->code,
                        'isBoard' => $division->is_board,
                    ])->all(),
                'users' => User::query()->visibleTo($actor)->active()
                    ->with('position:id,name')
                    ->orderBy('name')
                    ->get(['id', 'name', 'avatar_url', 'position_id', 'division_id'])
                    ->map(fn (User $user): array => [
                        'value' => $user->id,
                        'label' => $user->name,
                        'description' => $user->position?->name,
                        'avatar' => $user->avatar_url,
                    ])->all(),
                'levels' => PositionLevel::options(),
                // Dashboard per jabatan (F3): field hidden while FEATURE_ROLE_DASHBOARDS is off.
                'dashboardRoles' => config('features.role_dashboards') ? DashboardRole::options() : [],
            ],
            ...$props,
        ]);
    }

    protected function showDeleted(Request $request): bool
    {
        return $request->boolean('terhapus');
    }

    /**
     * @return array{id: string, name: string, avatar: string|null}|null
     */
    protected function personRef(?User $user): ?array
    {
        return $user === null ? null : ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url];
    }
}
