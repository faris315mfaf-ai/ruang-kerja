<?php

namespace App\Domain\Organization\Actions;

use App\Models\Team;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates a team. Input validated by TeamRequest (division in the
 * actor's company, code unique within the division, active lead).
 * Audited automatically (team.created / team.updated).
 */
final class SaveTeam
{
    /**
     * @param  array{division_id: string, name: string, code: string|null, lead_user_id: string|null}  $data
     */
    public function handle(array $data, ?Team $team = null): Team
    {
        return DB::transaction(function () use ($data, $team): Team {
            $team ??= new Team;

            $team->fill([
                'division_id' => $data['division_id'],
                'name' => $data['name'],
                'code' => $data['code'],
                'lead_user_id' => $data['lead_user_id'],
            ])->save();

            return $team;
        });
    }
}
