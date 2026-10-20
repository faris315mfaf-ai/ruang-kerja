<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Actions\ClearAttendanceDay;
use App\Domain\Attendance\Actions\SetAttendanceStatus;
use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Queries\AttendanceGrid;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Http\Controllers\Attendance\Concerns\FindsCompanyEmployee;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\ClearAttendanceDayRequest;
use App\Http\Requests\Attendance\SetAttendanceStatusRequest;
use App\Http\Resources\Attendance\EmployeeDayPresenter;
use App\Http\Resources\Attendance\RecapPresenter;
use App\Http\Resources\Attendance\TodayBoard;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Absensi › Pegawai (keputusan pemilik 20 Okt 2026): HR sees every
 * employee's month, sets a day's status by hand or removes a day
 * (docs/fitur/absensi-gaji.md). HR and Super Admin (attendance.manage).
 */
class AttendanceEmployeesController extends Controller
{
    use FindsCompanyEmployee;

    public function index(Request $request, #[CurrentUser] User $user, AttendanceGrid $grid, RecapPresenter $presenter): Response
    {
        Gate::authorize('manageDays', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);
        $divisions = TodayBoard::divisionOptions($user);
        $division = $request->string('divisi')->toString();
        $search = trim($request->string('q')->toString());
        $filters = [
            'division_id' => in_array($division, array_column($divisions, 'id'), true) ? $division : null,
            'search' => $search === '' ? null : mb_substr($search, 0, 80),
            'problems_only' => $request->boolean('bermasalah'),
        ];

        return Inertia::render('attendance/employees', [
            'period' => $presenter->period($period),
            'filters' => [
                'bulan' => $period->key(),
                'divisi' => $filters['division_id'],
                'q' => $filters['search'],
                'bermasalah' => $filters['problems_only'],
            ],
            'divisions' => $divisions,
            'grid' => fn (): array => $grid->forMonth($user, $period, $filters),
            'generatedAt' => $now->toIso8601ZuluString(),
            'can' => [
                'set_status' => true,
                'payroll' => $user->can('viewAny', PayrollPeriod::class),
            ],
        ]);
    }

    public function show(string $employee, string $date, #[CurrentUser] User $user, EmployeeDayPresenter $presenter): JsonResponse
    {
        Gate::authorize('manageDays', AttendanceDay::class);

        $person = $this->companyEmployee($user, $employee);

        return response()->json($presenter->detail($user, $person, $this->officeDate($date)));
    }

    public function update(SetAttendanceStatusRequest $request, string $employee, string $date, #[CurrentUser] User $user, SetAttendanceStatus $action): RedirectResponse
    {
        $person = $this->companyEmployee($user, $employee);
        $workDate = $this->officeDate($date);

        Gate::authorize('setStatus', [AttendanceDay::class, $person]);

        $day = $action->handle($user, $person, $workDate->toDateString(), $request->status(), $request->time('check_in'), $request->time('check_out'), $request->reason());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Status {$person->name} diatur: {$day->status->label()}."]);

        return back();
    }

    public function destroy(ClearAttendanceDayRequest $request, string $employee, string $date, #[CurrentUser] User $user, ClearAttendanceDay $action): RedirectResponse
    {
        $person = $this->companyEmployee($user, $employee);
        $workDate = $this->officeDate($date);

        Gate::authorize('clear', [AttendanceDay::class, $person]);

        $action->handle($user, $person, $workDate->toDateString(), $request->reason());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Catatan absensi {$person->name} dihapus."]);

        return back();
    }
}
