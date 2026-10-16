<?php

namespace App\Http\Controllers\Api\Hr;

use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\Queries\AttendanceDisciplineReport;
use App\Domain\Analytics\Services\AttendanceScopeResolver;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Absensi › Kedisiplinan for the Android app: the same data as the web tab
 * (AttendanceScopeResolver + AttendanceDisciplineReport, keputusan pemilik
 * 6 Okt 2026) — discipline KPIs, 8-week trend, completion rate and lead time
 * side by side (no combined score), one row per person. A division outside
 * the viewer's scope is 403. The Excel export stays on the desktop.
 */
class AttendanceDisciplineController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, AttendanceScopeResolver $scopes, AttendanceDisciplineReport $report): JsonResponse
    {
        Gate::authorize('viewTeam', AttendanceDay::class);

        $now = CarbonImmutable::now();
        $context = $scopes->resolve($user, $request->query(), $now);

        return response()->json([
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
            'report' => $report->build($user, $context->people, $context->filters, $now),
            'web_path' => '/absensi/kedisiplinan',
        ]);
    }
}
