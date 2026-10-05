<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Attendance\Data\RecapPeriod;
use App\Domain\Attendance\Exports\PayrollRecapExport;
use App\Domain\Attendance\Exports\RecapPdf;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Services\MonthlyRecap;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Http\Resources\Attendance\RecapPresenter;
use App\Http\Resources\Attendance\TodayBoard;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Absensi › Rekap bulanan (mockup RekapAbsensi, desktop) and its payroll
 * export (Excel / PDF, config/payroll_export.php).
 */
class AttendanceRecapController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPresenter $presenter): Response
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);
        $filters = $this->filters($request, $user);
        $selected = $request->string('karyawan')->toString();

        return Inertia::render('attendance/recap', [
            'period' => $presenter->period($period),
            'filters' => [...$filters, 'bulan' => $period->key(), 'karyawan' => $selected !== '' ? $selected : null],
            'divisions' => TodayBoard::divisionOptions($user),
            'report' => fn (): array => $presenter->report($recaps->report($user, $period, $filters)),
            'detail' => function () use ($selected, $user, $recaps, $presenter, $period): ?array {
                $employee = $selected === '' ? null : User::query()->whereIn('users.id', AttendanceDay::visibleUserIds($user))->find($selected);

                return $employee === null ? null : $presenter->detail($recaps->employee($employee, $period), $period, $user);
            },
            'generatedAt' => $now->toIso8601ZuluString(),
            'can' => [
                'export' => $user->can('export', AttendanceDay::class),
                'correct' => $user->hasPermission(Permission::AttendanceManage),
            ],
        ]);
    }

    public function export(Request $request, string $format, #[CurrentUser] User $user, MonthlyRecap $recaps, RecapPdf $pdf, AuditLogger $audit): HttpResponse
    {
        Gate::authorize('export', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $period = RecapPeriod::forMonth(RecapPeriod::normalize($request->string('bulan')->toString() ?: null, $now), $now);
        $filters = $this->filters($request, $user);
        $report = $recaps->report($user, $period, $filters);

        $audit->log('attendance.exported', null, null, [
            'format' => $format,
            'month' => $period->key(),
            'division_id' => $filters['division_id'],
            'rows' => count($report->rows),
        ]);

        return $format === 'pdf'
            ? $pdf->company($report, $user)
            : Excel::download(new PayrollRecapExport($report), PayrollRecapExport::filename($report, 'xlsx'));
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
