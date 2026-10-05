<?php

namespace App\Domain\Organization\Actions;

use App\Models\Position;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Soft-deletes a position. Refused while active employees still hold it.
 */
final class DeletePosition
{
    /**
     * @throws ValidationException
     */
    public function handle(Position $position): void
    {
        DB::transaction(function () use ($position): void {
            $locked = Position::query()->lockForUpdate()->findOrFail($position->id);
            $holders = $locked->users()->active()->count();

            if ($holders > 0) {
                throw ValidationException::withMessages([
                    'position' => "Jabatan {$locked->name} masih dipakai {$holders} karyawan aktif. Ganti jabatan mereka terlebih dahulu.",
                ]);
            }

            $locked->delete();
        });
    }
}
