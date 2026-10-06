<?php

namespace App\Domain\Organization\Actions;

use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Models\Position;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates a position in the actor's company, or updates an existing one.
 * Audited automatically (position.created / position.updated).
 */
final class SavePosition
{
    /**
     * @param  array{name: string, level: int, dashboard_role?: DashboardRole|null}  $data
     */
    public function handle(User $actor, array $data, ?Position $position = null): Position
    {
        return DB::transaction(function () use ($actor, $data, $position): Position {
            $position ??= new Position(['company_id' => $actor->company_id]);

            $position->fill([
                'name' => $data['name'],
                'level' => $data['level'],
            ]);

            if (array_key_exists('dashboard_role', $data)) {
                $position->dashboard_role = $data['dashboard_role'];
            }

            $position->save();

            return $position;
        });
    }
}
