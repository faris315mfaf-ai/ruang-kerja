<?php

namespace App\Http\Controllers\Api\Monitoring;

use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Http\Controllers\Controller;
use App\Models\DailyReport;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * One sent daily report for the detail sheet of the work monitoring in the
 * Android app (Bagian 4 / B4-C), same body as the web
 * Dashboard\MonitoringReportController: Gate `monitorDailyReport` (the
 * author, Direksi / HR / Super Admin of the company, the direct manager, the
 * Kepala Divisi of the author's division); drafts and anything else → 404.
 * Task titles only for tasks the viewer may see (ReportTasks), else the key.
 */
class MonitoringReportController extends Controller
{
    public function __invoke(DailyReport $dailyReport, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('monitorDailyReport', $dailyReport);

        $dailyReport->load(['items', 'user:id,name,avatar_url,division_id,company_id,manager_id', 'user.division:id,name']);
        $users = collect([$dailyReport->user])->keyBy('id');
        $report = DailyWorkMonitor::present($user, collect([$dailyReport]), $users)[0];

        return response()->json(['report' => [...$report, 'notes' => filled($dailyReport->notes) ? $dailyReport->notes : null]]);
    }
}
