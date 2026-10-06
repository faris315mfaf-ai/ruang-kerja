<?php

namespace App\Http\Controllers\Dashboard;

use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Http\Controllers\Controller;
use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * One sent daily report as JSON for the detail sheet of the work monitoring
 * (Direksi dashboard, Kepala Divisi panel). Gate `monitorDailyReport`
 * (AnalyticsServiceProvider): Direksi / HR / Super Admin of the company, the
 * author's direct manager and the Kepala Divisi of the author's division;
 * drafts and anything else answer 404.
 */
class MonitoringReportController extends Controller
{
    public function __invoke(DailyReport $dailyReport, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('monitorDailyReport', $dailyReport);

        $dailyReport->load(['items', 'user:id,name,avatar_url,division_id,company_id', 'user.division:id,name']);
        $users = collect([$dailyReport->user])->keyBy('id');
        $report = DailyWorkMonitor::present($user, collect([$dailyReport]), $users)[0];

        return response()->json(['report' => [...$report, 'notes' => filled($dailyReport->notes) ? $dailyReport->notes : null]]);
    }
}
