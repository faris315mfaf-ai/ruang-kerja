<?php

namespace App\Http\Controllers\Attendance\Concerns;

use App\Domain\Attendance\Services\ScheduleResolver;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Route parameters of Absensi › Pegawai / Gaji: an employee of the viewer's
 * own company (another company's id is a 404, never a 403) and an office
 * date "Y-m-d".
 */
trait FindsCompanyEmployee
{
    protected function companyEmployee(User $viewer, string $id): User
    {
        return User::query()->where('company_id', $viewer->company_id)->findOrFail($id);
    }

    protected function officeDate(string $date): CarbonImmutable
    {
        [$year, $month, $day] = array_map('intval', explode('-', $date)) + [0, 0, 0];

        abort_unless(checkdate($month, $day, $year) && $year >= 2000, 404);

        return ScheduleResolver::parseDate($date);
    }
}
