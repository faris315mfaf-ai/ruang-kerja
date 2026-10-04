<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deletes a location; shifts bound to it fall back to every active location.
 */
final class DeleteOfficeLocation
{
    public function handle(OfficeLocation $location): void
    {
        DB::transaction(function () use ($location): void {
            Shift::query()->where('office_location_id', $location->id)->each(function (Shift $shift): void {
                $shift->office_location_id = null;
                $shift->save();
            });

            $location->delete();
        });
    }
}
