<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Tenancy\Support\CurrentCompany;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Soft-deletes a shift that no current or future assignment uses (history
 * keeps pointing to it).
 */
final class DeleteShift
{
    public function handle(Shift $shift): void
    {
        $today = CarbonImmutable::now(CurrentCompany::timezone())->toDateString();

        $inUse = ShiftAssignment::query()
            ->where('shift_id', $shift->id)
            ->where(fn ($query) => $query->whereNull('valid_until')->orWhereDate('valid_until', '>=', $today))
            ->distinct()
            ->count('user_id');

        if ($inUse > 0) {
            throw ValidationException::withMessages([
                'shift' => "Shift {$shift->name} masih dipakai {$inUse} karyawan. Pindahkan penugasannya ke shift lain terlebih dulu.",
            ]);
        }

        $shift->delete();
    }
}
