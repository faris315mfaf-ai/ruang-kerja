<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\CorrectionWindow;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Attendance\Support\OfficeClock;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\MobileHistory;
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
 * check-in/out logs), the personal recap numbers and the period navigation —
 * with the calendar cells enriched for the app (work plan, flags, request,
 * correction entry; MobileHistory). `bulan=YYYY-MM` falls back to the running
 * month, like the web.
 */
class AttendanceHistoryController extends Controller
{
    public function __invoke(
        Request $request,
        #[CurrentUser] User $user,
        MonthlyRecap $recaps,
        RecapPresenter $presenter,
        MobileHistory $history,
    ): JsonResponse {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);
        $recap = $recaps->employee($user, $period);
        $window = CorrectionWindow::forUser($user);
        $detail = $presenter->detail($recap, $period, $user);
        $detail['days'] = $history->cells($recap, $period, $window);

        return response()->json([
            'period' => $presenter->period($period),
            'today' => OfficeClock::local($now)->toDateString(),
            'correction' => $history->correction($window),
            'recap' => $detail,
        ]);
    }
}
