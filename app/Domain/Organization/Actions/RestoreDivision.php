<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Support\UniqueViolations;
use App\Models\Division;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Restores a soft-deleted division (division.restored). Its code was never reused
 * (unique including deleted rows), so restoring cannot clash. A second board unit
 * is refused; a parent that is still deleted is detached.
 */
final class RestoreDivision
{
    /**
     * @throws ValidationException
     */
    public function handle(Division $division): Division
    {
        return UniqueViolations::asValidation(fn (): Division => DB::transaction(function () use ($division): Division {
            if ($division->is_board && Division::query()
                ->where('company_id', $division->company_id)
                ->where('is_board', true)
                ->exists()) {
                throw ValidationException::withMessages([
                    'division' => 'Sudah ada unit Direksi aktif. Hapus atau ubah unit tersebut terlebih dahulu.',
                ]);
            }

            if ($division->parent_id !== null && ! Division::query()->whereKey($division->parent_id)->exists()) {
                $division->parent_id = null;
            }

            $division->restore();

            return $division;
        }), [
            'divisions_one_board_per_company_unique' => ['division', 'Sudah ada unit Direksi aktif. Hapus atau ubah unit tersebut terlebih dahulu.'],
        ]);
    }
}
