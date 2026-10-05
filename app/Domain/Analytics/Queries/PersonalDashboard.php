<?php

namespace App\Domain\Analytics\Queries;

use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\MetricDefinitions\AttendanceDiscipline;
use App\Domain\Analytics\MetricDefinitions\AverageLateness;
use App\Domain\Analytics\MetricDefinitions\CompletionRate;
use App\Domain\Analytics\MetricDefinitions\LeadTimeMedian;
use App\Domain\Analytics\MetricDefinitions\OnTimeRate;
use App\Domain\Analytics\MetricDefinitions\OverdueTasks;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Analytics\Support\TaskSummary;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Http\Presenters\RequestPresenter;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Dashboard Saya" (PRD M7, mockups DashboardSaya / MBeranda): my tasks
 * today & this week, overdue, my attendance, leave balance and my requests.
 * Only the signed-in user's own data, so every employee may open it.
 */
final class PersonalDashboard
{
    private const array WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    public function __construct(
        private readonly MetricCache $cache,
        private readonly RequestPresenter $requests,
        private readonly BalanceLedger $ledger,
    ) {}

    /**
     * Cached metric blocks (5 minutes per user + filter).
     *
     * @return array<string, mixed>
     */
    public function metrics(User $user, DashboardFilters $filters, CarbonImmutable $now): array
    {
        $scope = MetricScope::personal($user);
        $today = Period::officeDate($now);

        return $this->cache->remember(
            DashboardView::Personal,
            $user,
            'metrics',
            [...$filters->cacheParts(), 'today' => $today->toDateString(), 'scope' => $scope->fingerprint()],
            fn (): array => $this->compute($scope, $filters->period, $today, $now),
        );
    }

    /**
     * Uncached, cheap blocks that must reflect actions immediately — including
     * "Fokus hari ini" and "Minggu ini" (a task assigned a minute ago shows).
     *
     * @return array<string, mixed>
     */
    public function live(User $user, CarbonImmutable $now): array
    {
        $user->loadMissing(['position:id,name', 'manager:id,name']);
        $scope = MetricScope::personal($user);
        $today = Period::officeDate($now);

        $requests = EmployeeRequest::query()
            ->ownedBy($user)
            ->where('status', '!=', RequestStatus::Draft->value)
            ->with(['leaveType', 'user.position', 'user.division', 'approvals.approver'])
            ->latest('created_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get();

        return [
            'profile' => [
                'position' => $user->position?->name,
                'manager' => $user->manager?->name,
            ],
            'leave_balance' => $this->leaveBalance($user, $now),
            'requests' => $requests->map(fn (EmployeeRequest $request): array => $this->requests->item($request))->values()->all(),
            'focus' => $this->focus($scope, $today),
            'week' => $this->week($scope, $today),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function compute(MetricScope $scope, Period $period, CarbonImmutable $today, CarbonImmutable $now): array
    {
        [$current, $previous] = $period->comparable($now);
        $completion = new CompletionRate;
        $onTime = new OnTimeRate;
        $leadTime = new LeadTimeMedian;
        $overdue = new OverdueTasks;
        $discipline = new AttendanceDiscipline;
        $lateness = new AverageLateness;

        return [
            'period' => $period->toArray(),
            'compared' => ['current' => $current->toArray(), 'previous' => $previous->toArray()],
            'kpis' => [
                'open_tasks' => [
                    'value' => $scope->tasks()->open()->count(),
                    'overdue' => (int) $overdue->compute($scope, $today)->value,
                ],
                'completed' => $this->completedCount($scope, $current)->compareTo($this->completedCount($scope, $previous)),
                'on_time_rate' => $onTime->compute($scope, $current)->compareTo($onTime->compute($scope, $previous)),
                'completion_rate' => $completion->compute($scope, $current)->compareTo($completion->compute($scope, $previous)),
                'lead_time' => $leadTime->compute($scope, $current)->compareTo($leadTime->compute($scope, $previous), 1),
            ],
            'attendance' => [
                'days' => $this->attendanceDays($scope, $current),
                'attendance_discipline' => $discipline->compute($scope, $current)->compareTo($discipline->compute($scope, $previous)),
                'average_lateness' => $lateness->compute($scope, $current)->compareTo($lateness->compute($scope, $previous)),
            ],
        ];
    }

    /**
     * Tasks I finished in the period (a count, shown next to the PRD metrics).
     */
    private function completedCount(MetricScope $scope, Period $period): MetricValue
    {
        return MetricValue::count($scope->tasks()
            ->where('tasks.status_category', TaskStatusCategory::Done->value)
            ->where('tasks.completed_at', '>=', $period->startUtc()->toIso8601String())
            ->where('tasks.completed_at', '<', $period->endUtc()->toIso8601String())
            ->count());
    }

    /**
     * "Fokus hari ini": open tasks, overdue first, then the nearest due date and priority.
     *
     * @return array{total: int, items: array<int, array<string, mixed>>}
     */
    private function focus(MetricScope $scope, CarbonImmutable $today): array
    {
        $tasks = $scope->tasks()
            ->open()
            ->with(['workspace:id,key,name'])
            ->withCount([
                'checklistItems',
                'checklistItems as checklist_done_count' => fn (Builder $query) => $query->where('is_done', true),
            ])
            ->orderByRaw('tasks.due_date asc nulls last')
            ->orderByRaw('case when tasks.priority = 0 then 9 else tasks.priority end')
            ->orderBy('tasks.number')
            ->limit(5)
            ->get();

        return [
            'total' => $scope->tasks()->open()->count(),
            'items' => $tasks->map(fn (Task $task): array => TaskSummary::from($task, $today))->values()->all(),
        ];
    }

    /**
     * "Minggu ini": tasks due on each day of the current week (not canceled).
     *
     * @return array{total: int, days: list<array{date: string, weekday: string, day: int, count: int, open: int, is_today: bool}>}
     */
    private function week(MetricScope $scope, CarbonImmutable $today): array
    {
        $start = $today->startOfWeek(CarbonImmutable::MONDAY);
        $rows = $scope->tasks()
            ->toBase()
            ->where('tasks.status_category', '!=', TaskStatusCategory::Canceled->value)
            ->where('tasks.due_date', '>=', $start->toDateString())
            ->where('tasks.due_date', '<', $start->addWeek()->toDateString())
            ->selectRaw('tasks.due_date::text as day, count(*) as total')
            ->selectRaw('count(*) filter (where tasks.status_category <> ?) as open', [TaskStatusCategory::Done->value])
            ->groupBy('tasks.due_date')
            ->get()
            ->keyBy('day');

        $days = [];

        for ($i = 0; $i < 7; $i++) {
            $date = $start->addDays($i);
            $row = $rows->get($date->toDateString());

            // Weekends only when something is due.
            if ($i >= 5 && $row === null) {
                continue;
            }

            $days[] = [
                'date' => $date->toDateString(),
                'weekday' => self::WEEKDAYS[$i],
                'day' => $date->day,
                'count' => (int) ($row->total ?? 0),
                'open' => (int) ($row->open ?? 0),
                'is_today' => $date->isSameDay($today),
            ];
        }

        return ['total' => array_sum(array_column($days, 'count')), 'days' => $days];
    }

    /**
     * Day strip of "Kehadiran": one entry per attendance row in the period.
     *
     * @return array{items: list<array{date: string, status: string, label: string, late_minutes: int}>, counts: array<string, int>, workdays: int}
     */
    private function attendanceDays(MetricScope $scope, Period $period): array
    {
        $days = AttendanceDay::query()
            ->whereIn('user_id', $scope->userIds)
            ->where('work_date', '>=', $period->startDate())
            ->where('work_date', '<', $period->endDate())
            ->orderBy('work_date')
            ->get(['id', 'work_date', 'status', 'late_minutes', 'shift_id']);

        $counts = ['present' => 0, 'late' => 0, 'absent' => 0, 'away' => 0];
        $workdays = 0;
        $items = [];

        foreach ($days as $day) {
            $items[] = [
                'date' => $day->work_date->toDateString(),
                'status' => $day->status->value,
                'label' => $day->status->label(),
                'late_minutes' => $day->late_minutes,
            ];

            if ($day->shift_id !== null && ! in_array($day->status, AttendanceDiscipline::EXCUSED, true)) {
                $workdays++;
            }

            match (true) {
                $day->status === AttendanceStatus::Late => $counts['late']++,
                $day->status === AttendanceStatus::Absent => $counts['absent']++,
                $day->status->comesFromRequest() => $counts['away']++,
                $day->status->isAttended() => $counts['present']++,
                default => null,
            };
        }

        return ['items' => $items, 'counts' => $counts, 'workdays' => $workdays];
    }

    /**
     * Annual leave ("Saldo cuti"): the first active leave type with a quota.
     *
     * @return array{type: string, remaining: float, year: int}|null
     */
    private function leaveBalance(User $user, CarbonImmutable $now): ?array
    {
        $type = LeaveType::query()
            ->visibleTo($user)
            ->active()
            ->where('category', RequestCategory::Leave->value)
            ->whereNotNull('annual_quota_days')
            ->ordered()
            ->first();

        if ($type === null) {
            return null;
        }

        $year = Period::officeDate($now)->year;
        $balance = $this->ledger->peek($user, $type, $year);

        return $balance === null ? null : ['type' => $type->name, 'remaining' => $balance->remaining(), 'year' => $year];
    }
}
