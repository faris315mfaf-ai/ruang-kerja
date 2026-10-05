<?php

namespace App\Domain\Analytics\Queries;

use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\MetricValue;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\MetricDefinitions\AttendanceDiscipline;
use App\Domain\Analytics\MetricDefinitions\AverageLateness;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Analytics\Services\TodayAttendance;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Services\SelfieStorage;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Http\Presenters\RequestPresenter;
use App\Models\RequestApproval;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * "Dashboard HR" (PRD M7, mockups DashboardHR / MDashboardHR): company-wide
 * attendance today (per division), unusual check-ins to review, requests
 * waiting for HR, missed check-outs yesterday and the period recap
 * (kedisiplinan hadir, rata-rata terlambat, alpha) with an 8-week trend.
 */
final class HrDashboard
{
    public function __construct(
        private readonly MetricCache $cache,
        private readonly TodayAttendance $attendance,
        private readonly RequestPresenter $requests,
        private readonly SelfieStorage $selfies,
    ) {}

    /**
     * Live: today's attendance + per-division table.
     *
     * @param  Collection<int, User>  $people  with `division` loaded
     * @return array<string, mixed>
     */
    public function today(Collection $people, CarbonImmutable $now): array
    {
        $today = $this->attendance->for($people, $now);
        $divisions = [];

        foreach ($today['people'] as $person) {
            $key = $person['user']['division_id'] ?? 'none';
            $divisions[$key] ??= [
                'id' => $person['user']['division_id'],
                'name' => $person['user']['division'] ?? 'Tanpa divisi',
                'scheduled' => 0, 'present' => 0, 'late' => 0, 'away' => 0, 'not_checked_in' => 0, 'absent' => 0,
            ];
            $divisions[$key]['scheduled']++;
            $divisions[$key][$person['state']]++;

            if ($person['state'] === 'late') {
                $divisions[$key]['present']++;
            }
        }

        usort($divisions, fn (array $a, array $b): int => $a['name'] <=> $b['name']);

        return [...$today, 'divisions' => $divisions];
    }

    /**
     * Live: unreviewed suspicious check-ins of the last 7 days ("Perlu ditinjau").
     *
     * @param  list<string>  $userIds
     * @return array{count: int, items: array<int, array<string, mixed>>}
     */
    public function review(User $viewer, array $userIds, CarbonImmutable $now): array
    {
        $query = AttendanceLog::query()
            ->where('is_suspicious', true)
            ->whereNull('reviewed_at')
            ->where('occurred_at', '>=', $now->subDays(7)->toIso8601String())
            ->whereIn('user_id', $userIds);

        $logs = (clone $query)
            ->with(['user:id,name,avatar_url,division_id,company_id,manager_id', 'user.division:id,name', 'officeLocation:id,name,radius_m'])
            ->latest('occurred_at')
            ->limit(5)
            ->get();

        return [
            'count' => $query->count(),
            'items' => $logs->map(fn (AttendanceLog $log): array => [
                'id' => $log->id,
                'user' => ['id' => $log->user->id, 'name' => $log->user->name, 'avatar' => $log->user->avatar_url, 'division' => $log->user->division?->name],
                'type' => $log->type->value,
                'method_label' => $log->method->label(),
                'occurred_at' => $log->occurred_at->toIso8601String(),
                'location' => $log->officeLocation?->name,
                'accuracy_m' => $log->accuracy_m,
                'distance_m' => $log->distance_m,
                'flags' => $log->flags
                    ->filter(fn (LogFlag $flag): bool => $flag->raisesSuspicion())
                    ->map(fn (LogFlag $flag): array => ['key' => $flag->value, 'label' => $flag->label()])
                    ->values()
                    ->all(),
                // Opening the signed URL is audited by AttendanceSelfieController.
                'selfie_url' => Gate::forUser($viewer)->allows('viewSelfie', $log) ? $this->selfies->temporaryUrl($log) : null,
            ])->values()->all(),
        ];
    }

    /**
     * Live: requests whose current step waits for HR (role step `hr`, or a
     * personal step routed to someone holding the HR role).
     *
     * @param  list<string>  $userIds  requesters in scope
     * @return array{count: int, items: array<int, array<string, mixed>>}
     */
    public function pendingHr(array $userIds): array
    {
        $hrUsers = User::role(Role::Hr->value)->select('users.id');

        $query = RequestApproval::query()
            ->where('status', ApprovalStatus::Waiting->value)
            ->where(fn (Builder $step) => $step
                ->where(fn (Builder $role) => $role->where('approver_type', ApproverType::Role->value)->where('approver_role', Role::Hr->value))
                ->orWhereIn('approver_id', $hrUsers))
            ->whereHas('request', fn (Builder $request) => $request
                ->where('status', RequestStatus::Pending->value)
                ->whereColumn('requests.round', 'request_approvals.round')
                ->whereIn('user_id', $userIds));

        $steps = (clone $query)
            ->with(['request.leaveType', 'request.user.position', 'request.user.division', 'request.approvals.approver'])
            ->oldest('activated_at')
            ->limit(4)
            ->get();

        return [
            'count' => $query->count(),
            'items' => $steps->map(fn (RequestApproval $step): array => $this->requests->item($step->request))->values()->all(),
        ];
    }

    /**
     * Live: yesterday's days with a check-in but no check-out ("Lupa check-out kemarin").
     *
     * @param  list<string>  $userIds
     * @return array{date: string, count: int, items: array<int, array<string, mixed>>}
     */
    public function missingCheckOut(array $userIds, CarbonImmutable $now): array
    {
        $yesterday = Period::officeDate($now)->subDay()->toDateString();
        $query = AttendanceDay::query()
            ->whereIn('user_id', $userIds)
            ->whereDate('work_date', $yesterday)
            ->whereNotNull('check_in_at')
            ->whereNull('check_out_at');

        $days = (clone $query)
            ->with(['user:id,name,avatar_url', 'shift:id,name'])
            ->orderBy('check_in_at')
            ->limit(6)
            ->get();

        return [
            'date' => $yesterday,
            'count' => $query->count(),
            'items' => $days->map(fn (AttendanceDay $day): array => [
                'id' => $day->id,
                'user' => ['id' => $day->user->id, 'name' => $day->user->name, 'avatar' => $day->user->avatar_url],
                'shift' => $day->shift?->name,
                'check_in_at' => $day->check_in_at?->toIso8601String(),
                'status' => $day->status->value,
            ])->values()->all(),
        ];
    }

    /**
     * Cached: period recap + 8-week discipline trend.
     *
     * @param  list<string>  $userIds
     * @return array<string, mixed>
     */
    public function recap(User $viewer, array $userIds, DashboardFilters $filters, CarbonImmutable $now): array
    {
        $scope = new MetricScope($viewer, $userIds);

        return $this->cache->remember(
            DashboardView::Hr,
            $viewer,
            'recap',
            [...$filters->cacheParts(), 'today' => Period::officeDate($now)->toDateString(), 'scope' => $scope->fingerprint()],
            function () use ($scope, $filters, $now): array {
                [$current, $previous] = $filters->period->comparable($now);
                $discipline = new AttendanceDiscipline;
                $lateness = new AverageLateness;
                $weeks = array_map(fn (Period $week): Period => $week->toDate($now), Period::weeksEndingAt($now));
                $trend = $discipline->series($scope, $weeks);

                return [
                    'period' => $filters->period->toArray(),
                    'compared' => ['current' => $current->toArray(), 'previous' => $previous->toArray()],
                    'kpis' => [
                        'attendance_discipline' => $discipline->compute($scope, $current)->compareTo($discipline->compute($scope, $previous)),
                        'average_lateness' => $lateness->compute($scope, $current)->compareTo($lateness->compute($scope, $previous)),
                        'absent_days' => $this->statusDays($scope, $current, AttendanceStatus::Absent)->compareTo($this->statusDays($scope, $previous, AttendanceStatus::Absent)),
                        'late_days' => $this->statusDays($scope, $current, AttendanceStatus::Late)->compareTo($this->statusDays($scope, $previous, AttendanceStatus::Late)),
                    ],
                    'trend' => array_map(fn (Period $week, int $index): array => [
                        'week_start' => $week->startDate(),
                        'label' => $week->shortLabel(),
                        ...$trend[$index]->toArray(),
                    ], $weeks, array_keys($weeks)),
                ];
            },
        );
    }

    private function statusDays(MetricScope $scope, Period $period, AttendanceStatus $status): MetricValue
    {
        return MetricValue::count(DB::table('attendance_days')
            ->whereIn('user_id', $scope->userIds)
            ->where('work_date', '>=', $period->startDate())
            ->where('work_date', '<', $period->endDate())
            ->where('status', $status->value)
            ->count());
    }
}
