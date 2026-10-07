<?php

namespace App\Domain\Analytics\Queries;

use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\MetricDefinitions\AttendanceDiscipline;
use App\Domain\Analytics\MetricDefinitions\CompletionRate;
use App\Domain\Analytics\MetricDefinitions\LeadTimeMedian;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Absensi › Kedisiplinan (keputusan pemilik 6 Okt 2026): the period recap that
 * used to sit on the HR dashboard — kedisiplinan hadir, rata-rata terlambat,
 * hari alpha, hari terlambat and the 8-week discipline trend
 * (HrDashboard::recap, unchanged) — plus tingkat penyelesaian and lead time
 * (moved off the Direksi dashboard) and a per-person table.
 *
 * Everything comes from the metric definitions; people are the attendance
 * scope of the viewer (AttendanceScopeResolver), tasks only from workspaces
 * the viewer may see (MetricScope). Cached 5 minutes per viewer + filter.
 */
final class AttendanceDisciplineReport
{
    public const string CACHE_KEY = 'kedisiplinan';

    public function __construct(
        private readonly MetricCache $cache,
        private readonly HrDashboard $hr,
    ) {}

    /**
     * @param  Collection<int, User>  $people  with `division:id,name`
     * @return array<string, mixed>
     */
    public function build(User $viewer, Collection $people, DashboardFilters $filters, CarbonImmutable $now): array
    {
        $ids = array_values(array_map('strval', $people->modelKeys()));
        $scope = new MetricScope($viewer, $ids);
        $recap = $this->hr->recap($viewer, $ids, $filters, $now);

        $extra = $this->cache->remember(
            self::CACHE_KEY,
            $viewer,
            'report',
            [...$filters->cacheParts(), 'today' => Period::officeDate($now)->toDateString(), 'scope' => $scope->fingerprint()],
            function () use ($scope, $people, $filters, $now): array {
                [$current, $previous] = $filters->period->comparable($now);
                $completion = new CompletionRate;
                $leadTime = new LeadTimeMedian;

                return [
                    'kpis' => [
                        'completion_rate' => $completion->compute($scope, $current)->compareTo($completion->compute($scope, $previous)),
                        'lead_time' => $leadTime->compute($scope, $current)->compareTo($leadTime->compute($scope, $previous), 1),
                    ],
                    'people' => $this->people($people, $current),
                ];
            },
        );

        return [
            ...$recap,
            'kpis' => [...$recap['kpis'], ...$extra['kpis']],
            'people' => $extra['people'],
        ];
    }

    /**
     * One row per person over the period to date (same day rules as
     * AttendanceDiscipline and AverageLateness), people with issues first.
     *
     * @param  Collection<int, User>  $people
     * @return list<array<string, mixed>>
     */
    private function people(Collection $people, Period $period): array
    {
        $excused = array_map(fn (AttendanceStatus $status): string => $status->value, AttendanceDiscipline::EXCUSED);
        $onTime = array_map(fn (AttendanceStatus $status): string => $status->value, AttendanceDiscipline::ON_TIME);
        $scheduled = 'shift_id is not null and status not in (?, ?, ?, ?, ?)';

        $rows = DB::table('attendance_days')
            ->whereIn('user_id', $people->modelKeys())
            ->where('work_date', '>=', $period->startDate())
            ->where('work_date', '<', $period->endDate())
            ->select('user_id')
            ->selectRaw("count(*) filter (where {$scheduled}) as scheduled", $excused)
            ->selectRaw("count(*) filter (where {$scheduled} and status in (?, ?)) as on_time", [...$excused, ...$onTime])
            ->selectRaw('count(*) filter (where late_minutes > 0) as late_days')
            ->selectRaw('coalesce(sum(late_minutes) filter (where late_minutes > 0), 0) as late_minutes')
            ->selectRaw('count(*) filter (where status = ?) as absent_days', [AttendanceStatus::Absent->value])
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $result = [];

        foreach ($people as $user) {
            $row = $rows->get($user->id);
            $scheduledDays = (int) ($row->scheduled ?? 0);
            $onTimeDays = (int) ($row->on_time ?? 0);
            $lateDays = (int) ($row->late_days ?? 0);

            $result[] = [
                'user' => ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar_url, 'division' => $user->division?->name],
                'scheduled' => $scheduledDays,
                'on_time' => $onTimeDays,
                'discipline' => $scheduledDays > 0 ? (int) round($onTimeDays / $scheduledDays * 100) : null,
                'late_days' => $lateDays,
                'average_late' => $lateDays > 0 ? (int) round((int) ($row->late_minutes ?? 0) / $lateDays) : null,
                'absent_days' => (int) ($row->absent_days ?? 0),
            ];
        }

        usort($result, fn (array $a, array $b): int => [$b['absent_days'], $b['late_days'], $a['discipline'] ?? 101, $a['user']['name']]
            <=> [$a['absent_days'], $a['late_days'], $b['discipline'] ?? 101, $b['user']['name']]);

        return $result;
    }
}
