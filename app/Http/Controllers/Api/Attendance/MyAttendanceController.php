<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Privacy\Services\MyData;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\MobileAttendanceState;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Own attendance of the token owner (GET /api/v1/absensi/hari-ini): the same
 * MyAttendance presenter as the web Absensi page — the next action, the
 * schedule, today's day and the allowed locations with their radius — plus an
 * explicit `state` (MobileAttendanceState) naming the screen state, the tab-bar
 * centre action and the consent status. The client derives "nearest location"
 * from its own GPS position.
 */
class MyAttendanceController extends Controller
{
    public function today(#[CurrentUser] User $user, MyAttendance $attendance, MyData $data): JsonResponse
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $today = $attendance->today($user, $now);
        $consent = $data->consent($user);

        return response()->json([
            'today' => $today,
            'serverTime' => $now->toIso8601ZuluString(),
            'state' => MobileAttendanceState::build($today, $now, [
                'granted' => $consent['granted'],
                'version' => $consent['version'],
                'needs_renewal' => $consent['needs_renewal'],
            ]),
        ]);
    }
}
