<?php

namespace App\Http\Controllers\Attendance\Admin;

use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\AttendanceSettingsData;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Lokasi, shift & hari libur (HR, Super Admin). Desktop only; mobile
 * shows the "Fitur ini tersedia di desktop." banner.
 */
class AttendanceSettingsController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, AttendanceSettingsData $data): Response
    {
        Gate::authorize('manage', OfficeLocation::class);

        $year = $request->integer('tahun') ?: null;

        return Inertia::render('admin/attendance/index', [
            'locations' => $data->locations($user),
            'shifts' => $data->shifts($user),
            'holidays' => $data->holidays($user, $year),
            'holidayYear' => $year,
            'holidayYears' => $data->holidayYears($user),
            'holidayTypes' => array_map(fn (HolidayType $type): array => ['value' => $type->value, 'label' => $type->label()], HolidayType::cases()),
            'geofence' => [
                'defaultRadius' => config()->integer('attendance.geofence.default_radius_m'),
                'minRadius' => config()->integer('attendance.geofence.min_radius_m'),
                'maxRadius' => config()->integer('attendance.geofence.max_radius_m'),
            ],
            'shiftDefaults' => [
                'lateToleranceMin' => config()->integer('attendance.schedule.default_late_tolerance_min'),
                'checkInWindowBeforeMin' => config()->integer('attendance.schedule.default_check_in_window_before_min'),
            ],
        ]);
    }
}
