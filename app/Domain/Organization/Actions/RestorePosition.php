<?php

namespace App\Domain\Organization\Actions;

use App\Models\Position;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Restores a soft-deleted position (position.restored) unless an active position
 * with the same name was created in the meantime.
 */
final class RestorePosition
{
    /**
     * @throws ValidationException
     */
    public function handle(Position $position): Position
    {
        return DB::transaction(function () use ($position): Position {
            $duplicate = Position::query()
                ->where('company_id', $position->company_id)
                ->whereRaw('lower(name) = ?', [mb_strtolower($position->name)])
                ->exists();

            if ($duplicate) {
                throw ValidationException::withMessages([
                    'position' => "Sudah ada jabatan aktif bernama {$position->name}.",
                ]);
            }

            $position->restore();

            return $position;
        });
    }
}
