<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\MyAttendance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AttendanceController extends Controller
{
    /**
     * Absensi page (mobile-first): today's card, check-in flow and 30-day history.
     */
    public function index(#[CurrentUser] User $user, MyAttendance $attendance): Response
    {
        Gate::authorize('viewAny', AttendanceDay::class);

        $now = CarbonImmutable::now();

        return Inertia::render('attendance/index', [
            'today' => $attendance->today($user, $now),
            'consent' => [
                'granted' => AttendanceConsent::hasCurrentConsent($user),
                'version' => AttendanceConsent::currentVersion(),
                'retentionMonths' => config()->integer('attendance.selfie.retention_months'),
            ],
            'serverTime' => $now->toIso8601ZuluString(),
            'history' => Inertia::defer(fn (): array => $attendance->history($user, $now)),
        ]);
    }

    /**
     * Full privacy policy for attendance data (linked from the consent screen).
     */
    public function policy(): Response
    {
        return Inertia::render('attendance/privacy-policy', [
            'version' => AttendanceConsent::currentVersion(),
            'retentionMonths' => config()->integer('attendance.selfie.retention_months'),
        ]);
    }
}
