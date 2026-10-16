<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\TodayBoard;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Absensi › Hari ini for the Android app (HR, Direksi, Super Admin: the
 * company; Kepala Divisi: their division; managers: direct reports). Same
 * TodayBoard data as the web board (AttendanceDay::visibleUserIds); the app
 * polls every `poll_seconds` instead of listening on Reverb.
 */
class AttendanceBoardController extends Controller
{
    public const int POLL_SECONDS = 60;

    public function __invoke(Request $request, #[CurrentUser] User $user, TodayBoard $board): JsonResponse
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $location = $request->string('lokasi')->toString();
        $locations = TodayBoard::locationOptions($user);
        $locationId = in_array($location, array_column($locations, 'id'), true) ? $location : null;

        return response()->json([
            'filters' => ['lokasi' => $locationId],
            'locations' => $locations,
            'divisions' => TodayBoard::divisionOptions($user),
            'board' => $board->build($user, $now, $locationId),
            'suspicious' => $board->suspicious($user),
            'missing_check_out' => $board->missingCheckOut($user, $now),
            'can' => [
                'correct' => $user->hasPermission(Permission::AttendanceManage),
                'review' => $user->hasPermission(Permission::AttendanceManage),
            ],
            'poll_seconds' => self::POLL_SECONDS,
            'web_path' => '/absensi/hari-ini',
        ]);
    }
}
