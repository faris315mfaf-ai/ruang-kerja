<?php

namespace App\Domain\RoleDashboards\Queries;

use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Models\Division;
use App\Models\Position;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * Fills the `RoleDashboard` page prop (resources/js/features/role-dashboards/types.ts)
 * for one job from the existing dashboard queries: portfolio (Dirut,
 * Direktur), HR attendance + approval queue (HR) and the division dashboard
 * (the five division jobs). Access is checked by the caller (Gate
 * `viewRoleDashboard`); every block is scoped to what the viewer may see.
 */
final class RoleDashboardPresenter
{
    public function __construct(
        private readonly BoardRoleDashboard $board,
        private readonly HrRoleDashboard $hr,
        private readonly UnitRoleDashboard $unit,
    ) {}

    /**
     * @param  Collection<int, Division>  $divisions  allowed divisions (unit jobs)
     * @return array<string, mixed>
     */
    public function dashboard(User $viewer, DashboardRole $role, Collection $divisions, ?Division $division, CarbonImmutable $now): array
    {
        $body = match ($role) {
            DashboardRole::Dirut, DashboardRole::Direktur => $this->board->build($viewer, $role, $now),
            DashboardRole::Hr => $this->hr->build($viewer, $now),
            default => $this->unit->build($viewer, $role, $divisions, $division, $now),
        };

        $position = $viewer->position_id !== null ? Position::query()->whereKey($viewer->position_id)->value('name') : null;

        return [
            'role' => $role->value,
            'label' => $role->label(),
            'position' => is_string($position) ? $position : null,
            'flow' => $role->flow(),
            'held' => null,
            ...$body,
        ];
    }

    /**
     * Data of the job's task flow (null for held flows).
     *
     * @return array<string, mixed>|null
     */
    public function flow(User $viewer, DashboardRole $role, ?string $selectedId): ?array
    {
        return match ($role) {
            DashboardRole::Dirut => ['kind' => 'decision', ...$this->board->decisionFlow($viewer)],
            DashboardRole::Direktur => ['kind' => 'approvals', ...$this->board->approvalFlow($viewer)],
            DashboardRole::Hr => ['kind' => 'leave-review', ...$this->hr->reviewFlow($viewer, $selectedId)],
            default => null,
        };
    }
}
