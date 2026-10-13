<?php

namespace App\Http\Controllers\Api\Monitoring;

use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Services\DashboardContextResolver;
use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Domain\Monitoring\Queries\ProjectWorkMonitor;
use App\Domain\Monitoring\Queries\WeeklyWorkMonitor;
use App\Domain\Monitoring\Queries\WorkspaceDirectory;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Monitoring kerja Direksi of the Android app (Bagian 5 / B5-A): the four
 * tabs of the web /dashboard/direksi, one endpoint per deferred block, over
 * the same queries (DailyWorkMonitor, WeeklyWorkMonitor, ProjectWorkMonitor,
 * WorkspaceDirectory) and the same Gate `viewDashboard` Direksi
 * (`portfolio.view`: Direksi, Super Admin; others 403). The tab "Catatan" is
 * /catatan-tindakan, one report's detail /monitoring/laporan/{id} (B4-C).
 */
class WorkMonitoringController extends Controller
{
    public function __construct(private readonly DashboardContextResolver $contexts) {}

    /** ?tanggal=YYYY-MM-DD (up to today; anything else = today). */
    public function daily(Request $request, #[CurrentUser] User $user, DailyWorkMonitor $daily): JsonResponse
    {
        [$context, $now, $today] = $this->context($request, $user);
        $date = self::pickDate($request->query('tanggal'), $today);

        return response()->json([
            'today' => $today->toDateString(),
            'date' => $date->toDateString(),
            'daily' => $daily->for($user, $context->people, $date, $now),
        ]);
    }

    /** ?minggu=YYYY-MM-DD (any day of the week; up to today). */
    public function weekly(Request $request, #[CurrentUser] User $user, WeeklyWorkMonitor $weekly): JsonResponse
    {
        [$context, $now, $today] = $this->context($request, $user);
        $monday = WeeklyWorkMonitor::weekStart(self::pickDate($request->query('minggu'), $today));

        return response()->json([
            'today' => $today->toDateString(),
            'week' => $monday->toDateString(),
            'weekly' => $weekly->for($user, $context->people, $monday, $now),
        ]);
    }

    /** Tracking per project for the week of ?minggu=. */
    public function projects(Request $request, #[CurrentUser] User $user, ProjectWorkMonitor $projects): JsonResponse
    {
        [, , $today] = $this->context($request, $user);
        $monday = WeeklyWorkMonitor::weekStart(self::pickDate($request->query('minggu'), $today));

        return response()->json([
            'today' => $today->toDateString(),
            'week' => $monday->toDateString(),
            'projects' => $projects->for($user, $monday),
        ]);
    }

    /**
     * "Akses cepat workspace": ?q= (name or key) and ?jenis=project|division|team.
     */
    public function workspaces(Request $request, #[CurrentUser] User $user, WorkspaceDirectory $directory): JsonResponse
    {
        Gate::authorize('viewDashboard', DashboardView::Direksi);

        $q = mb_strtolower(trim((string) (is_string($request->query('q')) ? $request->query('q') : '')));
        $type = $request->query('jenis');
        $type = is_string($type) && in_array($type, ['project', 'division', 'team'], true) ? $type : null;

        $rows = array_values(array_filter($directory->for($user), function (array $row) use ($q, $type): bool {
            if ($type !== null && $row['type'] !== $type) {
                return false;
            }

            return $q === '' || str_contains(mb_strtolower((string) $row['name']), $q) || str_contains(mb_strtolower((string) $row['key']), $q);
        }));

        return response()->json(['filters' => ['q' => $q === '' ? null : $q, 'jenis' => $type], 'workspaces' => $rows]);
    }

    /**
     * @return array{0: DashboardContext, 1: CarbonImmutable, 2: CarbonImmutable}
     */
    private function context(Request $request, User $user): array
    {
        Gate::authorize('viewDashboard', DashboardView::Direksi);

        $now = CarbonImmutable::now();
        /** @var array<string, mixed> $query */
        $query = $request->query();

        return [$this->contexts->resolve($user, DashboardView::Direksi, $query, $now), $now, Period::officeDate($now)];
    }

    /**
     * Office date from the query: a valid date up to today, anything else is
     * today (same rule as the web Direksi dashboard).
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
}
