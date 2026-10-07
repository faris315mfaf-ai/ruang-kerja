<?php

namespace App\Domain\Reports\Queries;

use App\Domain\Reports\Support\ReportDay;
use App\Models\DailyReport;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * The signed-in employee's own daily reports: today's status (Beranda card
 * "Laporan hari ini"), today's form and the history list (/laporan).
 */
final class MyDailyReports
{
    public function __construct(private readonly ReportTaskOptions $tasks) {}

    /**
     * Beranda card: status of today's report (one query).
     *
     * @return array{date: string, status: string, submitted_at: string|null, updated_at: string|null, items_count: int, locks_at: string}
     */
    public function status(User $user, ?CarbonImmutable $now = null): array
    {
        $today = ReportDay::today($now);
        $report = DailyReport::query()
            ->where('user_id', $user->id)
            ->whereDate('report_date', $today)
            ->withCount('items')
            ->first();

        return [
            'date' => $today,
            'status' => $report === null ? 'missing' : ($report->isSubmitted() ? 'submitted' : 'draft'),
            'submitted_at' => $report?->submitted_at?->toIso8601String(),
            'updated_at' => $report?->updated_at?->toIso8601String(),
            'items_count' => (int) ($report?->getAttribute('items_count') ?? 0),
            'locks_at' => ReportDay::locksAt($today)->toIso8601String(),
        ];
    }

    /**
     * /laporan/hari-ini: today's report (or an empty one) and task options.
     *
     * @return array{report: array<string, mixed>, suggestions: list<array<string, mixed>>, chosen: list<array<string, mixed>>}
     */
    public function form(User $user, ?CarbonImmutable $now = null): array
    {
        $today = ReportDay::today($now);
        $report = DailyReport::query()
            ->where('user_id', $user->id)
            ->whereDate('report_date', $today)
            ->with('items')
            ->first();

        $taskIds = $report === null ? [] : array_values(array_filter($report->items->pluck('task_id')->all()));
        $visible = ReportPresenter::visibleTaskIds($user, $taskIds);

        return [
            'report' => $report === null ? [
                'id' => null,
                'date' => $today,
                'status' => 'missing',
                'submitted_at' => null,
                'updated_at' => null,
                'editable' => true,
                'summary' => null,
                'blockers' => null,
                'notes' => null,
                'items_count' => 0,
                'hours' => null,
                'items' => [],
            ] : ReportPresenter::report($report, $visible, $today),
            'suggestions' => $this->tasks->suggestions($user),
            // Options of the tasks already on the report (may not be suggested any more).
            'chosen' => $this->tasks->byIds($user, array_keys($visible)),
        ];
    }

    /**
     * Reports of $owner, newest first: all of them for the owner, sent ones for a reader.
     *
     * @return list<array<string, mixed>>
     */
    public function history(User $owner, User $viewer, int $limit = 60): array
    {
        $reports = DailyReport::query()
            ->where('user_id', $owner->id)
            ->when(! $viewer->is($owner), fn ($query) => $query->whereNotNull('submitted_at'))
            ->withCount('items')
            ->withSum('items as hours_total', 'hours')
            ->orderByDesc('report_date')
            ->limit($limit)
            ->get();

        $today = ReportDay::today();

        return array_values($reports->map(fn (DailyReport $report): array => [
            'id' => $report->id,
            'date' => $report->report_date->toDateString(),
            'status' => $report->isSubmitted() ? 'submitted' : 'draft',
            'submitted_at' => $report->submitted_at?->toIso8601String(),
            'summary' => $report->summary,
            'has_blockers' => $report->blockers !== null && $report->blockers !== '',
            'items_count' => (int) $report->getAttribute('items_count'),
            'hours' => is_numeric($report->getAttribute('hours_total')) && (float) $report->getAttribute('hours_total') > 0 ? round((float) $report->getAttribute('hours_total'), 2) : null,
            'editable' => $viewer->is($owner) && $report->report_date->toDateString() === $today,
        ])->all());
    }

    /**
     * One report for a reader (detail page).
     *
     * @return array<string, mixed>
     */
    public function detail(DailyReport $report, User $viewer): array
    {
        $report->loadMissing('items');
        $visible = ReportPresenter::visibleTaskIds($viewer, $report->items->pluck('task_id'));

        return ReportPresenter::report($report, $visible);
    }
}
