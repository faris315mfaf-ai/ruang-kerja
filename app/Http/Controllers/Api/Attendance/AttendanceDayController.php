<?php

namespace App\Http\Controllers\Api\Attendance;

use App\Domain\Attendance\Data\RecapDay;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\CorrectionWindow;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Attendance\Support\OfficeClock;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\MobileHistory;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Own day detail (GET /api/v1/absensi/hari/{date}): the calendar cell of that
 * date from the same MonthlyRecap as the calendar (so the kind/status never
 * disagree), every log of the day and the correction entry. Only the token
 * owner's data; the selfie is never returned.
 */
class AttendanceDayController extends Controller
{
    public function __invoke(
        string $date,
        #[CurrentUser] User $user,
        MonthlyRecap $recaps,
        MobileHistory $history,
    ): JsonResponse {
        Gate::authorize('viewAny', AttendanceDay::class);

        $day = self::parseDate($date);
        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth($day->format('Y-m'), $now);
        $cell = collect($recaps->employee($user, $period)->days)->first(fn (RecapDay $cell): bool => $cell->date === $day->toDateString());

        abort_if($cell === null, 404, 'Tanggal tidak ditemukan.');

        $window = CorrectionWindow::forUser($user);
        $pending = $window->available() ? (CorrectionWindow::requestsByDate($user, $cell->date, $cell->date)[$cell->date] ?? null) : null;

        return response()->json($history->detail($cell, $window, $pending, OfficeClock::local($now)->toDateString()));
    }

    /**
     * @throws ValidationException
     */
    private static function parseDate(string $date): CarbonImmutable
    {
        try {
            $parsed = CarbonImmutable::createFromFormat('!Y-m-d', $date);
        } catch (Throwable) {
            $parsed = null;
        }

        if ($parsed === null || $parsed->format('Y-m-d') !== $date || $parsed->year < 2000) {
            throw ValidationException::withMessages(['date' => 'Format tanggal harus YYYY-MM-DD, mis. 2026-10-13.']);
        }

        return $parsed;
    }
}
