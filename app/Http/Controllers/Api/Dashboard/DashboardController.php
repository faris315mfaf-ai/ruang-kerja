<?php

namespace App\Http\Controllers\Api\Dashboard;

use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\Queries\DivisionDashboard;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Analytics\Services\DashboardContextResolver;
use App\Domain\Announcements\Queries\AnnouncementFeed;
use App\Domain\Briefings\Queries\BriefingWindow;
use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Dashboard\DashboardController as WebDashboardController;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Non-staff dashboards of the Android app (Bagian 2 / B2-B) as JSON over the
 * very queries of the web dashboards (DivisionDashboard, HrDashboard,
 * DailyWorkMonitor, BriefingWindow, AnnouncementFeed): same Gate
 * `viewDashboard` (403 when not allowed), same filter resolution
 * (DashboardContextResolver — a division or team outside the viewer's scope
 * is a 403, a malformed period falls back to the default). Direksi,
 * Manajemen and the role dashboards belong to Bagian 5.
 */
class DashboardController extends Controller
{
    public function __construct(
        private readonly DashboardAccess $access,
        private readonly DashboardContextResolver $contexts,
        private readonly DivisionDashboard $division,
        private readonly HrDashboard $hr,
        private readonly DailyWorkMonitor $daily,
        private readonly BriefingWindow $briefingWindow,
        private readonly AnnouncementFeed $announcements,
    ) {}

    /**
     * The views the viewer may open (the picker) and the landing view.
     */
    public function views(#[CurrentUser] User $user): JsonResponse
    {
        $default = $this->access->defaultView($user);

        return response()->json([
            'awal' => $default->value,
            'tampilan' => array_map(fn (DashboardView $view): array => [
                'key' => $view->value,
                'label' => $view->label(),
                'active' => $view === $default,
                'tersedia' => true,
            ], $this->access->views($user)),
        ]);
    }

    /**
     * Dashboard Kepala Divisi. `?bagian=`: `semua` (default) · `langsung`
     * (today's attendance, approval queue, team reports — fast) · `metrik`
     * (cached KPIs, trend, workload, overdue, projects — the web deferred
     * prop), so the app can paint the shell first.
     */
    public function division(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewDashboard', DashboardView::Division);

        $now = CarbonImmutable::now();
        $context = $this->contexts->resolve($user, DashboardView::Division, $request->query(), $now);
        $part = self::part($request);

        $payload = $this->header($context);

        if ($part !== 'metrik') {
            $payload['attendance'] = $this->division->today($context->people, $now);
            $payload['approvals'] = $this->division->approvals($user);
            $payload['reports'] = WebDashboardController::teamReports(
                $this->daily->for($user, $context->people, Period::officeDate($now), $now),
            );
        }

        if ($part !== 'langsung') {
            $payload['metrics'] = $this->division->metrics($user, $context->people, $context->filters, $now);
        }

        return response()->json($payload);
    }

    /**
     * Dashboard HR: requests waiting for HR, today's attendance numbers, the
     * Hiring pointer, the "Catat briefing" card and the announcement slot.
     */
    public function hr(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewDashboard', DashboardView::Hr);

        $now = CarbonImmutable::now();
        $context = $this->contexts->resolve($user, DashboardView::Hr, $request->query(), $now);
        $hiring = WebDashboardController::hiringUrl();
        $card = $this->briefingWindow->card($user, $now);

        if ($card !== null) {
            unset($card['urls']);
        }

        return response()->json([
            ...$this->header($context),
            'attendance' => $this->hr->attendanceSummary($user, $context->people, $now),
            'pending' => $this->hr->pendingHr($context->userIds()),
            // Hiring is a Bagian 5 module: the app only learns whether the web has it.
            'hiring' => ['tersedia' => $hiring !== null],
            'briefing' => $card,
            'pengumuman' => $this->announcements->banner($user),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function header(DashboardContext $context): array
    {
        return [
            'view' => $context->view->value,
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
        ];
    }

    private static function part(Request $request): string
    {
        $value = $request->query('bagian');

        return is_string($value) && in_array($value, ['langsung', 'metrik'], true) ? $value : 'semua';
    }
}
