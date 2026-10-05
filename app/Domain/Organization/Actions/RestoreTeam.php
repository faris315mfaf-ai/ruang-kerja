<?php

namespace App\Domain\Organization\Actions;

use App\Models\Division;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Restores a soft-deleted team (team.restored). Its division must be active and
 * its code must still be free within that division.
 */
final class RestoreTeam
{
    /**
     * @throws ValidationException
     */
    public function handle(Team $team): Team
    {
        return DB::transaction(function () use ($team): Team {
            $division = Division::withTrashed()->findOrFail($team->division_id);

            if ($division->trashed()) {
                throw ValidationException::withMessages([
                    'team' => "Divisi {$division->name} sudah dihapus. Pulihkan divisinya terlebih dahulu.",
                ]);
            }

            if ($team->code !== null && Team::query()
                ->where('division_id', $team->division_id)
                ->where('code', $team->code)
                ->exists()) {
                throw ValidationException::withMessages([
                    'team' => "Kode {$team->code} sudah dipakai tim lain di divisi {$division->name}.",
                ]);
            }

            $team->restore();

            return $team;
        });
    }
}
