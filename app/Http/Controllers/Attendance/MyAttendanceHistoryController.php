<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Exports\RecapPdf;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\RecapPresenter;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * "Absensi Saya" (mockup MRiwayatAbsensi + RekapAbsensi detail panel): the
 * employee's own monthly recap, calendar and logs, with a personal PDF.
 */
class MyAttendanceHistoryController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPresenter $presenter): Response
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);

        return Inertia::render('attendance/history', [
            'period' => $presenter->period($period),
            'today' => $now->setTimezone(config()->string('app.office_timezone'))->toDateString(),
            'recap' => fn (): array => $presenter->detail($recaps->employee($user, $period), $period, $user),
        ]);
    }

    public function pdf(Request $request, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPdf $pdf): HttpResponse
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);

        return $pdf->personal($recaps->employee($user, $period), $period);
    }
}
