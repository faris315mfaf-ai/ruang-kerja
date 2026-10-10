<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Own attendance of the token owner (GET /api/v1/absensi/hari-ini): the same
 * MyAttendance presenter as the web Absensi page — the next action, the
 * schedule, today's day and the allowed locations with their radius. The
 * client derives "nearest location" from its own GPS position.
 */
class MyAttendanceController extends Controller
{
    public function today(#[CurrentUser] User $user, MyAttendance $attendance): JsonResponse
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();

        return response()->json([
            'today' => $attendance->today($user, $now),
            'serverTime' => $now->toIso8601ZuluString(),
        ]);
    }
}
