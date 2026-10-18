<?php

namespace App\Http\Controllers\Dashboard;

use App\Domain\Analytics\Actions\BuildDashboardExport;
use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\Queries\DivisionDashboard;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Analytics\Queries\PersonalDashboard;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Analytics\Services\DashboardContextResolver;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Briefings\Queries\BriefingWindow;
use App\Domain\Briefings\Queries\LatestBriefing;
use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Domain\Monitoring\Queries\ManagementNotes;
use App\Domain\Monitoring\Queries\ProjectWorkMonitor;
use App\Domain\Monitoring\Queries\WeeklyWorkMonitor;
use App\Domain\Monitoring\Queries\WorkspaceDirectory;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Tasks\Queries\TugasHariIni;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Excel as ExcelType;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Dashboards (PRD M7): Saya, Kepala Divisi, HR, Direksi. `/dashboard` opens
 * the viewer's default view; the picker links to
 * `/dashboard/{saya|divisi|hr|direksi}`.
 *
 * Keputusan pemilik 6 Okt 2026: the HR dashboard keeps requests waiting for
 * HR and short summaries (attendance lives in Absensi); the Direksi
 * dashboard shows daily / weekly / per-project work monitoring, action notes
 * and quick access to every workspace — no completion, lead time,
 * discipline, lateness, trend, attendance today or overdue tasks.
 *
 * Metric blocks are deferred props (skeleton first) cached 5 minutes per
 * viewer + filter; live blocks are closures so the page can reload them
 * alone (`only: ['today']`) when an attendance broadcast arrives.
 */
class DashboardController extends Controller
{
    public function __construct(
        private readonly DashboardAccess $access,
        private readonly DashboardContextResolver $contexts,
        private readonly PersonalDashboard $personalQueries,
        private readonly DivisionDashboard $divisionQueries,
        private readonly HrDashboard $hrQueries,
        private readonly DailyWorkMonitor $daily,
        private readonly WeeklyWorkMonitor $weekly,
        private readonly ProjectWorkMonitor $projects,
        private readonly ManagementNotes $notes,
        private readonly WorkspaceDirectory $workspaces,
        private readonly BriefingWindow $briefingWindow,
        private readonly TugasHariIni $tugasHariIni,
        private readonly LatestBriefing $latestBriefing,
    ) {}

    public function index(Request $request, #[CurrentUser] User $user): Response
    {
        return $this->render($request, $user, $this->access->defaultView($user));
    }

    public function show(Request $request, #[CurrentUser] User $user, DashboardView $view): Response
    {
        return $this->render($request, $user, $view);
    }

    public function export(
        Request $request,
        #[CurrentUser] User $user,
        DashboardView $view,
        BuildDashboardExport $build,
        AuditLogger $audit,
    ): BinaryFileResponse {
        Gate::authorize('viewDashboard', $view);

        $now = CarbonImmutable::now();
        $context = $this->contexts->resolve($user, $view, $request->query(), $now);
        $audit->log('dashboard.exported', null, null, ['view' => $view->value, ...$context->filters->toQuery()]);

        return Excel::download($build->handle($context, $now), BuildDashboardExport::filename($view, $now), ExcelType::XLSX);
    }

    private function render(Request $request, User $user, DashboardView $view): Response
    {
        Gate::authorize('viewDashboard', $view);

        $now = CarbonImmutable::now();
        $context = $this->contexts->resolve($user, $view, $request->query(), $now);

        $shared = [
            'view' => $view->value,
            'views' => $this->picker($user, $view),
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
            'today' => CarbonImmutable::now(CurrentCompany::timezone())->toDateString(),
            'exportUrl' => '/dashboard/'.$view->value.'/ekspor',
            // Kartu "Catat briefing" (keputusan pemilik 9 Okt 2026): null for
            // employees who are neither HR / Super Admin nor a delegate today.
            'briefing' => fn (): ?array => $this->briefingWindow->card($user, $now),
        ];

        return match ($view) {
            DashboardView::Personal => $this->personal($context, $now, $shared),
            DashboardView::Division => $this->division($context, $now, $shared),
            DashboardView::Hr => $this->hr($context, $now, $shared),
            DashboardView::Direksi => $this->direksi($request, $context, $now, $shared),
        };
    }

    /**
     * @param  array<string, mixed>  $shared
     */
    private function personal(DashboardContext $context, CarbonImmutable $now, array $shared): Response
    {
        $queries = $this->personalQueries;

        return Inertia::render('dashboard/personal', [
            ...$shared,
            'live' => fn (): array => $queries->live($context->viewer, $now),
            // Kartu "Tugas hari ini" (keputusan pemilik 9 Okt 2026): pribadi /
            // tim / semua — replaces "Ruang saya" (planner) and the "Laporan
            // hari ini" card on this page.
            'tugasHariIni' => fn (): array => $this->tugasHariIni->for($context->viewer, $now),
            // "Briefing terakhir" for every viewer (keputusan pemilik 9 Okt
            // 2026): same shape as GET /api/v1/briefing/terakhir's `briefing`.
            'latestBriefing' => fn (): ?array => $this->latestBriefing->for($context->viewer),
            'metrics' => Inertia::defer(fn (): array => $queries->metrics($context->viewer, $context->filters, $now)),
        ]);
    }

    /**
     * @param  array<string, mixed>  $shared
     */
    private function division(DashboardContext $context, CarbonImmutable $now, array $shared): Response
    {
        $queries = $this->divisionQueries;
        $daily = $this->daily;

        return Inertia::render('dashboard/division', [
            ...$shared,
            'channels' => $this->attendanceChannels($context),
            'attendance' => fn (): array => $queries->today($context->people, $now),
            'approvals' => fn (): array => $queries->approvals($context->viewer),
            // "Laporan tim hari ini" (keputusan pemilik 6 Okt 2026): who sent today's progress report.
            'reports' => fn (): array => self::teamReports($daily->for($context->viewer, $context->people, Period::officeDate($now), $now)),
            'metrics' => Inertia::defer(fn (): array => $queries->metrics($context->viewer, $context->people, $context->filters, $now)),
        ]);
    }

    /**
     * @param  array<string, mixed>  $shared
     */
    private function hr(DashboardContext $context, CarbonImmutable $now, array $shared): Response
    {
        $queries = $this->hrQueries;
        $ids = $context->userIds();

        // Keputusan pemilik 6 Okt 2026: attendance panels and the discipline
        // recap moved to Absensi (Hari ini · Rekap · Kedisiplinan).
        return Inertia::render('dashboard/hr', [
            ...$shared,
            'channels' => [AttendanceRecorded::companyChannel($context->viewer->company_id)],
            'attendance' => fn (): array => $queries->attendanceSummary($context->viewer, $context->people, $now),
            'pending' => fn (): array => $queries->pendingHr($ids),
            'hiring' => self::hiringUrl(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $shared
     */
    private function direksi(Request $request, DashboardContext $context, CarbonImmutable $now, array $shared): Response
    {
        $today = Period::officeDate($now);
        $date = self::pickDate($request->query('tanggal'), $today);
        $monday = WeeklyWorkMonitor::weekStart(self::pickDate($request->query('minggu'), $today));
        $viewer = $context->viewer;
        $people = $context->people;

        return Inertia::render('dashboard/direksi', [
            ...$shared,
            'monitoring' => [
                'date' => $date->toDateString(),
                'week' => $monday->toDateString(),
                'today' => $today->toDateString(),
            ],
            'daily' => Inertia::defer(fn (): array => $this->daily->for($viewer, $people, $date, $now), 'harian'),
            'weekly' => Inertia::defer(fn (): array => $this->weekly->for($viewer, $people, $monday, $now), 'mingguan'),
            'projects' => Inertia::defer(fn (): array => $this->projects->for($viewer, $monday), 'proyek'),
            'notes' => fn (): array => $this->notes->for($viewer, $now),
            'workspaces' => fn (): array => $this->workspaces->for($viewer),
        ]);
    }

    /**
     * Office date from the query (`?tanggal=` / `?minggu=`): a valid date up
     * to today, anything else is today (a bookmarked URL never errors).
     */
    private static function pickDate(mixed $value, CarbonImmutable $today): CarbonImmutable
    {
        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1
            || ! checkdate((int) substr($value, 5, 2), (int) substr($value, 8, 2), (int) substr($value, 0, 4))) {
            return $today;
        }

        $date = CarbonImmutable::createFromFormat('!Y-m-d', $value, $today->getTimezone());

        return $date === null || $date->gt($today) ? $today : $date;
    }

    /**
     * Kadiv panel: counts, who has not reported and the sent reports (no items).
     *
     * @param  array<string, mixed>  $daily  DailyWorkMonitor::for()
     * @return array<string, mixed>
     */
    public static function teamReports(array $daily): array
    {
        /** @var list<array<string, mixed>> $reports */
        $reports = $daily['reports'];

        return [
            'date' => $daily['date'],
            'totals' => $daily['totals'],
            'missing' => $daily['missing'],
            'reports' => array_map(fn (array $report): array => [
                'id' => $report['id'],
                'user' => $report['user'],
                'submitted_at' => $report['submitted_at'],
                'items_count' => $report['items_count'],
                'has_blockers' => $report['blockers'] !== null,
            ], $reports),
        ];
    }

    /**
     * Link of the Hiring module card on the HR dashboard, only once that
     * module (built separately) registers `/hiring`.
     */
    public static function hiringUrl(): ?string
    {
        return isset(Route::getRoutes()->get('GET')['hiring']) ? '/hiring' : null;
    }

    /**
     * Picker entries: the views this user may open.
     *
     * @return list<array{key: string, label: string, href: string, active: bool}>
     */
    private function picker(User $user, DashboardView $current): array
    {
        return array_map(fn (DashboardView $view): array => [
            'key' => $view->value,
            'label' => $view->label(),
            'href' => $view->path(),
            'active' => $view === $current,
        ], $this->access->views($user));
    }

    /**
     * Private channels with live check-ins for the people on screen
     * (`AttendanceRecorded`): the whole company for viewers with
     * attendance.view_all, else one channel per division in scope.
     *
     * @return array<int, string>
     */
    private function attendanceChannels(DashboardContext $context): array
    {
        if ($context->viewer->hasPermission(Permission::AttendanceViewAll)) {
            return [AttendanceRecorded::companyChannel($context->viewer->company_id)];
        }

        return $context->people->pluck('division_id')->filter()->unique()->map(fn (string $id): string => "division.{$id}.attendance")->values()->all();
    }
}
