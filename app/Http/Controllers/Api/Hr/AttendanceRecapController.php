<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Organization\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\RecapPresenter;
use App\Http\Resources\Attendance\TodayBoard;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Absensi › Rekap bulanan for the Android app (keputusan pemilik Bagian 5:
 * per-employee list + one employee's month with the calendar; the Excel/PDF
 * payroll export stays on the desktop). Same MonthlyRecap + RecapPresenter
 * and the same scope as the web page (AttendanceDay::visibleUserIds).
 */
class AttendanceRecapController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPresenter $presenter): JsonResponse
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = $this->period($request, $now);
        $filters = $this->filters($request, $user);

        return response()->json([
            'period' => $presenter->period($period),
            'filters' => [
                'bulan' => $period->key(),
                'divisi' => $filters['division_id'],
                'q' => $filters['search'],
            ],
            'divisions' => TodayBoard::divisionOptions($user),
            'report' => $presenter->report($recaps->report($user, $period, $filters)),
            'generated_at' => $now->toIso8601ZuluString(),
            'can' => $this->can($user),
            'web_path' => '/absensi/rekap',
        ]);
    }

    /**
     * One employee's month: the numbers, a calendar cell per date and the
     * logs of the month. 404 outside the viewer's attendance scope.
     */
    public function show(Request $request, string $employee, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPresenter $presenter): JsonResponse
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $person = User::query()->whereIn('users.id', AttendanceDay::visibleUserIds($user))->findOrFail($employee);
        $period = $this->period($request, CarbonImmutable::now());

        return response()->json([
            'period' => $presenter->period($period),
            'detail' => $presenter->detail($recaps->employee($person, $period), $period, $user),
            'can' => [
                ...$this->can($user),
                'correct' => Gate::allows('correct', [AttendanceDay::class, $person]),
            ],
        ]);
    }

    private function period(Request $request, CarbonImmutable $now): RecapPeriod
    {
        return RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);
    }

    /**
     * @return array{export: bool, correct: bool}
     */
    private function can(User $user): array
    {
        return [
            // The export exists on the desktop only: the app shows the banner when true.
            'export' => $user->can('export', AttendanceDay::class),
            'correct' => $user->hasPermission(Permission::AttendanceManage),
        ];
    }

    /**
     * @return array{division_id: string|null, search: string|null}
     */
    private function filters(Request $request, User $user): array
    {
        $division = $request->string('divisi')->toString();
        $search = trim($request->string('q')->toString());

        return [
            'division_id' => in_array($division, array_column(TodayBoard::divisionOptions($user), 'id'), true) ? $division : null,
            'search' => $search === '' ? null : mb_substr($search, 0, 80),
        ];
    }
}
