<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Holiday;

final class DeleteHoliday
{
    public function handle(Holiday $holiday): void
    {
        $holiday->delete();
    }
}
