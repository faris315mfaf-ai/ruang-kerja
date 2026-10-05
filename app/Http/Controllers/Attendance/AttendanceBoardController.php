<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\TodayBoard;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * HR › Absensi hari ini: live board (Echo `company.{id}.attendance` /
 * `division.{id}.attendance` + polling), flagged logs, missing check-outs.
 */
class AttendanceBoardController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, TodayBoard $board): Response
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $location = $request->string('lokasi')->toString();
        $locations = TodayBoard::locationOptions($user);
        $locationId = in_array($location, array_column($locations, 'id'), true) ? $location : null;

        return Inertia::render('attendance/board', [
            'filters' => ['lokasi' => $locationId],
            'locations' => $locations,
            'divisions' => TodayBoard::divisionOptions($user),
            'board' => fn (): array => $board->build($user, $now, $locationId),
            'suspicious' => fn (): array => $board->suspicious($user),
            'missingCheckOut' => fn (): array => $board->missingCheckOut($user, $now),
            'channels' => TodayBoard::channels($user),
            'can' => [
                'correct' => $user->hasPermission(Permission::AttendanceManage),
                'recap' => true,
            ],
        ]);
    }
}
