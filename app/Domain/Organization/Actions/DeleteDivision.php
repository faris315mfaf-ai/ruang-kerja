<?php

namespace App\Domain\Organization\Actions;

use App\Models\Division;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Soft-deletes a division. Refused while it still has active employees, teams or
 * sub-divisions: HR must move them first so nobody ends up without a division.
 * Inactive/resigned employees keep their historical division_id.
 */
final class DeleteDivision
{
    /**
     * @throws ValidationException
     */
    public function handle(Division $division): void
    {
        DB::transaction(function () use ($division): void {
            $locked = Division::query()->lockForUpdate()->findOrFail($division->id);

            $members = $locked->members()->active()->count();
            $teams = $locked->teams()->count();
            $children = $locked->children()->count();

            $blockers = array_filter([
                $members > 0 ? "{$members} karyawan aktif" : null,
                $teams > 0 ? "{$teams} tim" : null,
                $children > 0 ? "{$children} sub-divisi" : null,
            ]);

            if ($blockers !== []) {
                throw ValidationException::withMessages([
                    'division' => "Divisi {$locked->name} masih memiliki ".self::join($blockers).'. Pindahkan atau hapus terlebih dahulu.',
                ]);
            }

            $locked->delete();
        });
    }

    /**
     * "a", "a dan b", "a, b, dan c".
     *
     * @param  array<int, string>  $parts
     */
    private static function join(array $parts): string
    {
        $parts = array_values($parts);
        $last = array_pop($parts);

        if ($parts === []) {
            return (string) $last;
        }

        return implode(', ', $parts).(count($parts) > 1 ? ', dan ' : ' dan ').$last;
    }
}
