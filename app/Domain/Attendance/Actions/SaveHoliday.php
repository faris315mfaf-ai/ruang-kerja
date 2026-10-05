<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\Holiday;
use App\Models\User;
use Carbon\CarbonImmutable;

final class SaveHoliday
{
    public function handle(User $actor, CarbonImmutable $date, string $name, HolidayType $type, ?Holiday $holiday = null): Holiday
    {
        $holiday ??= new Holiday(['company_id' => $actor->company_id]);

        $holiday->fill([
            'date' => $date->toDateString(),
            'name' => trim($name),
            'type' => $type,
        ]);
        $holiday->save();

        return $holiday;
    }
}
