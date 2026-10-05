<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Support\UniqueViolations;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Creates or updates a team. Input validated by TeamRequest (division in the
 * actor's company, code unique within the division, active lead).
 * Audited automatically (team.created / team.updated).
 *
 * A team with active members never changes division: their users.division_id
 * would no longer match the team's division. Move the members first.
 */
final class SaveTeam
{
    /**
     * @param  array{division_id: string, name: string, code: string|null, lead_user_id: string|null}  $data
     *
     * @throws ValidationException
     */
    public function handle(array $data, ?Team $team = null): Team
    {
        // Concurrent saves that both passed TeamRequest: the unique index decides.
        return UniqueViolations::asValidation(fn (): Team => DB::transaction(function () use ($data, $team): Team {
            if ($team?->exists) {
                $team = Team::query()->lockForUpdate()->findOrFail($team->id);
                self::ensureMovable($team, $data['division_id']);
            }

            $team ??= new Team;

            $team->fill([
                'division_id' => $data['division_id'],
                'name' => $data['name'],
                'code' => $data['code'],
                'lead_user_id' => $data['lead_user_id'],
            ])->save();

            return $team;
        }), [
            'teams_division_code_unique' => ['code', "Kode {$data['code']} sudah dipakai tim lain di divisi ini."],
        ]);
    }

    /**
     * @throws ValidationException
     */
    public static function ensureMovable(Team $team, string $divisionId): void
    {
        if ($team->division_id === $divisionId) {
            return;
        }

        $members = $team->members()->active()->count();

        if ($members > 0) {
            throw ValidationException::withMessages([
                'division_id' => "{$team->name} masih memiliki {$members} anggota aktif. Pindahkan anggota ke tim lain terlebih dahulu sebelum mengganti divisi tim.",
            ]);
        }
    }
}
