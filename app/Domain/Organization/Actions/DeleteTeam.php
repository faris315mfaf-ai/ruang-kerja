<?php

namespace App\Domain\Organization\Actions;

use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Soft-deletes a team. Refused while active employees are still in it.
 */
final class DeleteTeam
{
    /**
     * @throws ValidationException
     */
    public function handle(Team $team): void
    {
        DB::transaction(function () use ($team): void {
            $locked = Team::query()->lockForUpdate()->findOrFail($team->id);
            $members = $locked->members()->active()->count();

            if ($members > 0) {
                throw ValidationException::withMessages([
                    'team' => "{$locked->name} masih memiliki {$members} anggota aktif. Keluarkan anggota dari tim terlebih dahulu.",
                ]);
            }

            $locked->delete();
        });
    }
}
