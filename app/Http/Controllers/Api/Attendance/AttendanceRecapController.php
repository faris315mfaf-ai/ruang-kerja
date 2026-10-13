<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Exports\RecapPdf;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\RecapPresenter;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Own monthly recap (GET /api/v1/absensi/rekap) and its PDF
 * (GET /api/v1/absensi/rekap/unduh) — the numbers and the personal PDF of the
 * web "Absensi Saya" page (MonthlyRecap::employee, RecapPdf::personal). Only
 * the token owner's data; no leave balance and no combined score.
 */
class AttendanceRecapController extends Controller
{
    /** Formats the web personal recap offers (it has no personal Excel). */
    public const array FORMATS = ['pdf'];

    public function show(Request $request, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPresenter $presenter): JsonResponse
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);
        $recap = $recaps->employee($user, $period);
        $row = $presenter->row($recap);

        return response()->json([
            'period' => $presenter->period($period),
            'recap' => [
                ...Arr::only($row, [
                    'shiftName', 'workDays', 'presentDays', 'lateCount', 'lateMinutes', 'earlyLeaveCount', 'absentDays',
                    'leaveDays', 'permitDays', 'sickDays', 'businessTripDays', 'wfhDays', 'needsCorrectionDays', 'offDays',
                    'overtimeHours', 'attendanceRate', 'averageCheckIn',
                ]),
                'overtimeMinutes' => $recap->overtimeMinutes,
            ],
            'downloadFormats' => self::FORMATS,
        ]);
    }

    public function download(Request $request, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPdf $pdf): Response
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $format = strtolower($request->string('format')->toString() ?: 'pdf');

        if (! in_array($format, self::FORMATS, true)) {
            throw ValidationException::withMessages([
                'format' => 'Format unduhan rekap pribadi hanya PDF. Rekap Excel belum tersedia untuk karyawan.',
            ]);
        }

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);

        return $pdf->personal($recaps->employee($user, $period), $period);
    }
}
