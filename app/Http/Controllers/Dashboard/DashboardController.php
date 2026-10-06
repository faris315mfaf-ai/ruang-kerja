<?php

namespace App\Http\Controllers\Dashboard;

use App\Domain\Analytics\Actions\BuildDashboardExport;
use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\Queries\DivisionDashboard;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Analytics\Queries\PersonalDashboard;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Analytics\Services\DashboardContextResolver;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Services\AuditLogger;
use App\Domain\Planner\Queries\PersonalPlanner;
use App\Domain\Reports\Queries\MyDailyReports;
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
 * Dashboards (PRD M7): Saya, Kepala Divisi, HR. `/dashboard` opens the
 * viewer's default view; the picker links to `/dashboard/{saya|divisi|hr}`
 * and, for Direksi, to the portfolio (`/portofolio`, Sprint 9 part B).
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
        private readonly PersonalPlanner $planner,
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
            'today' => CarbonImmutable::now(config()->string('app.office_timezone'))->toDateString(),
            'exportUrl' => '/dashboard/'.$view->value.'/ekspor',
        ];

        return match ($view) {
            DashboardView::Personal => $this->personal($context, $now, $shared),
            DashboardView::Division => $this->division($context, $now, $shared),
            DashboardView::Hr => $this->hr($context, $now, $shared),
        };
    }

    /**
     * @param  array<string, mixed>  $shared
     */
    private function personal(DashboardContext $context, CarbonImmutable $now, array $shared): Response
    {
        $queries = $this->personalQueries;
        $planner = $this->planner;

        return Inertia::render('dashboard/personal', [
            ...$shared,
            'live' => fn (): array => $queries->live($context->viewer, $now),
            // "Ruang saya": the viewer's own plan, never cached (reloads alone with `only`).
            'planner' => fn (): array => $planner->for($context->viewer, $now),
            // Kartu "Laporan hari ini" (keputusan pemilik 6 Okt 2026): one query.
            'dailyReport' => fn (): array => app(MyDailyReports::class)->status($context->viewer, $now),
            'metrics' => Inertia::defer(fn (): array => $queries->metrics($context->viewer, $context->filters, $now)),
        ]);
    }

    /**
     * @param  array<string, mixed>  $shared
     */
    private function division(DashboardContext $context, CarbonImmutable $now, array $shared): Response
    {
        $queries = $this->divisionQueries;

        return Inertia::render('dashboard/division', [
            ...$shared,
            'channels' => $this->attendanceChannels($context),
            'attendance' => fn (): array => $queries->today($context->people, $now),
            'approvals' => fn (): array => $queries->approvals($context->viewer),
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

        return Inertia::render('dashboard/hr', [
            ...$shared,
            'channels' => [AttendanceRecorded::companyChannel($context->viewer->company_id)],
            'attendance' => fn (): array => $queries->today($context->people, $now),
            'review' => fn (): array => $queries->review($context->viewer, $ids, $now),
            'pending' => fn (): array => $queries->pendingHr($ids),
            'missingCheckOut' => fn (): array => $queries->missingCheckOut($context->viewer, $ids, $now),
            'recap' => Inertia::defer(fn (): array => $queries->recap($context->viewer, $ids, $context->filters, $now)),
        ]);
    }

    /**
     * Picker entries: the views this user may open, plus the Direksi portfolio link.
     *
     * @return list<array{key: string, label: string, href: string, active: bool}>
     */
    private function picker(User $user, DashboardView $current): array
    {
        $items = array_map(fn (DashboardView $view): array => [
            'key' => $view->value,
            'label' => $view->label(),
            'href' => $view->path(),
            'active' => $view === $current,
        ], $this->access->views($user));

        if ($this->access->canSeePortfolio($user)) {
            $items[] = ['key' => 'direksi', 'label' => 'Direksi', 'href' => '/portofolio', 'active' => false];
        }

        return $items;
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
