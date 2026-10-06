<?php

namespace App\Domain\Reports\Queries;

use App\Domain\Reports\Services\ReportReaders;
use App\Models\Company;
use App\Models\DailyReport;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Shared read model of the daily reports of one office date for a reader:
 * Laporan tim (/laporan), and — reused by the Kepala Divisi panel "Laporan
 * tim hari ini" and the Direksi work monitoring. Only people the viewer may
 * read (ReportReaders: direct reports, the led divisions, everyone for
 * Direksi/HR/Super Admin), never the viewer. Drafts count as not sent and
 * their content is never exposed. Five queries regardless of the size.
 *
 * Shape:
 * [
 *   'date' => 'Y-m-d',
 *   'counts' => ['total' => int, 'submitted' => int, 'draft' => int, 'missing' => int],
 *   'people' => list<[
 *     'user' => ['id', 'name', 'avatar', 'position', 'division'],
 *     'status' => 'submitted' | 'draft' | 'missing',
 *     'report' => null | [ // sent reports only, see ReportPresenter::report()
 *       'id', 'date', 'status', 'submitted_at', 'updated_at', 'editable', 'summary',
 *       'blockers', 'notes', 'items_count', 'hours',
 *       'items' => list<['id', 'task_id', 'task_key', 'task_title' (null when the
 *         viewer cannot see the task), 'is_task', 'progress_note', 'percent',
 *         'hours', 'move_status_id', 'status_category_after']>,
 *     ],
 *   ]>, // sent first (latest first), then drafts, then missing; by name
 * ]
 */
final class DailyReportFeed
{
    public function __construct(private readonly ReportReaders $readers) {}

    /**
     * @param  callable(Builder<User>): mixed|null  $people  optional extra filter on the people (e.g. one division)
     * @return array{date: string, counts: array{total: int, submitted: int, draft: int, missing: int}, people: list<array<string, mixed>>}
     */
    public function forDate(Company|string $company, CarbonInterface|string $date, User $viewer, ?callable $people = null): array
    {
        $companyId = $company instanceof Company ? $company->id : $company;
        $day = $date instanceof CarbonInterface ? $date->toDateString() : $date;

        $query = $this->readers->readableUsers($viewer)
            ->where('company_id', $companyId)
            ->with(['position:id,name', 'division:id,name'])
            ->orderBy('name');

        if ($people !== null) {
            $people($query);
        }

        /** @var Collection<int, User> $users */
        $users = $companyId === $viewer->company_id ? $query->get() : new Collection;

        /** @var Collection<string, DailyReport> $reports */
        $reports = DailyReport::query()
            ->whereIn('user_id', $users->modelKeys())
            ->whereDate('report_date', $day)
            ->with('items')
            ->get()
            ->keyBy('user_id');

        $visible = ReportPresenter::visibleTaskIds($viewer, ReportPresenter::taskIdsOf($reports->filter(fn (DailyReport $report): bool => $report->isSubmitted())));
        $rank = ['submitted' => 0, 'draft' => 1, 'missing' => 2];

        $rows = $users->map(function (User $user) use ($reports, $visible): array {
            $report = $reports->get($user->id);
            $sent = $report !== null && $report->isSubmitted();

            return [
                'user' => ReportPresenter::person($user),
                'status' => $report === null ? 'missing' : ($sent ? 'submitted' : 'draft'),
                'report' => $sent ? ReportPresenter::report($report, $visible) : null,
            ];
        })->sortBy([
            fn (array $a, array $b): int => $rank[$a['status']] <=> $rank[$b['status']],
            fn (array $a, array $b): int => strcmp((string) ($b['report']['submitted_at'] ?? ''), (string) ($a['report']['submitted_at'] ?? '')),
            fn (array $a, array $b): int => strcmp($a['user']['name'], $b['user']['name']),
        ])->values();

        return [
            'date' => $day,
            'counts' => [
                'total' => $rows->count(),
                'submitted' => $rows->where('status', 'submitted')->count(),
                'draft' => $rows->where('status', 'draft')->count(),
                'missing' => $rows->where('status', 'missing')->count(),
            ],
            'people' => array_values($rows->all()),
        ];
    }
}
