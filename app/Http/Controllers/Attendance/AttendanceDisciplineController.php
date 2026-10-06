<?php

namespace App\Http\Controllers\Attendance;

use App\Domain\Analytics\Actions\BuildDisciplineExport;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\Queries\AttendanceDisciplineReport;
use App\Domain\Analytics\Services\AttendanceScopeResolver;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Excel as ExcelType;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Absensi › Kedisiplinan (keputusan pemilik 6 Okt 2026): the discipline recap
 * moved off the HR dashboard plus tingkat penyelesaian & lead time, for the
 * people whose attendance the viewer may see (Gate viewTeam: HR, Direksi,
 * Super Admin, Kepala Divisi, managers).
 */
class AttendanceDisciplineController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, AttendanceScopeResolver $scopes, AttendanceDisciplineReport $report): Response
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $context = $scopes->resolve($user, $request->query(), $now);

        return Inertia::render('attendance/discipline', [
            'filters' => [
                ...$context->filters->toQuery(),
                'period' => $context->filters->period->toArray(),
                'presets' => PeriodPreset::options(),
                ...$context->options(),
            ],
            'scope' => [
                'label' => $context->scopeLabel(),
                'member_count' => $context->people->count(),
            ],
            'definitions' => MetricCatalog::definitions(),
            'exportUrl' => '/absensi/kedisiplinan/ekspor',
            'report' => Inertia::defer(fn (): array => $report->build($user, $context->people, $context->filters, $now)),
        ]);
    }

    public function export(Request $request, #[CurrentUser] User $user, AttendanceScopeResolver $scopes, BuildDisciplineExport $build, AuditLogger $audit): BinaryFileResponse
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $context = $scopes->resolve($user, $request->query(), $now);
        $audit->log('attendance.discipline_exported', null, null, $context->filters->toQuery());

        return Excel::download($build->handle($context, $now), BuildDisciplineExport::filename($now), ExcelType::XLSX);
    }
}
