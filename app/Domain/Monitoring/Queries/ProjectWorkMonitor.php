<?php

namespace App\Domain\Monitoring\Queries;

use App\Domain\Projects\Queries\ProjectMetrics;
use App\Domain\Projects\Services\ProjectClock;
use App\Domain\Projects\Services\ProjectPresenter;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Monitoring per proyek (keputusan pemilik 6 Okt 2026): the open projects of
 * the viewer's portfolio (Workspace::portfolioFor, as on /portofolio) with
 * the PIC's health, actual vs planned progress, next milestone
 * (ProjectMetrics + ProjectPresenter, the same numbers as the portfolio) and
 * how much the week's daily reports touched the project: sent reports naming
 * one of its tasks and how many people wrote them.
 *
 * Query count does not grow with the number of projects.
 */
final class ProjectWorkMonitor
{
    public function __construct(private readonly ProjectMetrics $metrics) {}

    /**
     * @return array{total: int, projects: list<array<string, mixed>>}
     */
    public function for(User $viewer, CarbonImmutable $monday): array
    {
        $today = ProjectClock::today();
        $projects = Workspace::query()
            ->portfolioFor($viewer)
            ->whereNull('archived_at')
            ->with(['lead:id,name,avatar_url', 'sponsor:id,name,avatar_url', 'division:id,name'])
            ->get()
            ->filter(fn (Workspace $workspace): bool => ProjectMetrics::status($workspace)->isOpen())
            ->values();

        if ($projects->isEmpty()) {
            return ['total' => 0, 'projects' => []];
        }

        $metrics = $this->metrics->forWorkspaces($projects, $today);
        $activity = DB::table('daily_report_items')
            ->join('daily_reports', 'daily_reports.id', '=', 'daily_report_items.daily_report_id')
            ->join('tasks', 'tasks.id', '=', 'daily_report_items.task_id')
            ->where('daily_reports.company_id', $viewer->company_id)
            ->whereNotNull('daily_reports.submitted_at')
            ->where('daily_reports.report_date', '>=', $monday->toDateString())
            ->where('daily_reports.report_date', '<=', $monday->addDays(6)->toDateString())
            ->whereIn('tasks.workspace_id', $projects->modelKeys())
            ->groupBy('tasks.workspace_id')
            ->select('tasks.workspace_id')
            ->selectRaw('count(distinct daily_reports.id) as reports')
            ->selectRaw('count(distinct daily_reports.user_id) as people')
            ->selectRaw('count(distinct daily_report_items.task_id) as tasks')
            ->selectRaw('coalesce(sum(daily_report_items.hours), 0) as hours')
            ->get()
            ->keyBy('workspace_id');

        $rows = array_values($projects
            ->sortBy(fn (Workspace $workspace): string => sprintf(
                '%d|%s|%s',
                $workspace->health?->rank() ?? 1,
                $workspace->target_date?->toDateString() ?? '9999-12-31',
                mb_strtolower($workspace->name),
            ))
            ->map(function (Workspace $workspace) use ($metrics, $activity): array {
                $week = $activity->get($workspace->id);

                return [
                    ...ProjectPresenter::project($workspace, $metrics[$workspace->id]),
                    'url' => '/w/'.$workspace->key.'/ringkasan',
                    'week' => [
                        'reports' => (int) ($week->reports ?? 0),
                        'people' => (int) ($week->people ?? 0),
                        'tasks' => (int) ($week->tasks ?? 0),
                        'hours' => isset($week->hours) && (float) $week->hours > 0 ? round((float) $week->hours, 2) : null,
                    ],
                ];
            })
            ->all());

        return ['total' => count($rows), 'projects' => $rows];
    }
}
