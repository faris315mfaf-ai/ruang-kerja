<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\RecapPresenter;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Own monthly history of the token owner (GET /api/v1/absensi/riwayat):
 * the same RecapPeriod + MonthlyRecap + RecapPresenter machinery as the web
 * "Absensi Saya" page — the days of the month (calendar cells with their
 * check-in/out logs), the personal recap numbers and the period navigation.
 * `bulan=YYYY-MM` falls back to the running month, like the web.
 */
class AttendanceHistoryController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPresenter $presenter): JsonResponse
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);

        return response()->json([
            'period' => $presenter->period($period),
            'recap' => $presenter->detail($recaps->employee($user, $period), $period, $user),
        ]);
    }
}
