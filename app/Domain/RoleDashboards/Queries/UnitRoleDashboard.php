<?php

namespace App\Domain\RoleDashboards\Queries;

use App\Domain\Analytics\Data\DashboardFilters;
use App\Domain\Analytics\Data\MetricScope;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Enums\PeriodPreset;
use App\Domain\Analytics\Queries\DivisionDashboard;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Analytics\Services\MetricCache;
use App\Domain\Analytics\Services\TodayAttendance;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Domain\RoleDashboards\Support\Blocks;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Division;
use App\Models\Position;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * Division-based job dashboards (Sekretaris Perusahaan, Branding &
 * Marketing, Programming, Implementer, Analis): this month's task metrics,
 * overdue tasks, workload per person and attendance today of one division —
 * the same numbers as Dashboard Kepala Divisi (DivisionDashboard). Viewers
 * without the division dashboard (staff holding such a position) see their
 * own numbers. The job's design flow is held until its module exists.
 */
final class UnitRoleDashboard
{
    public const int OVERDUE_ROWS = 6;

    public const int WORKLOAD_BARS = 6;

    public const int UPCOMING_DAYS = 7;

    public const int UPCOMING_ROWS = 5;

    public function __construct(
        private readonly DashboardAccess $access,
        private readonly DivisionDashboard $division,
        private readonly TodayAttendance $attendance,
        private readonly MetricCache $cache,
    ) {}

    /**
     * Divisions the viewer may pick (empty: personal scope).
     *
     * @return Collection<int, Division>
     */
    public function divisions(User $viewer): Collection
    {
        return $this->access->can($viewer, DashboardView::Division)
            ? $this->access->divisions($viewer, DashboardView::Division)
            : new Collection;
    }

    /**
     * The division on screen: the requested one when allowed, else the
     * viewer's own (when allowed), else the division of someone holding this
     * job (Direksi looking over a Kadiv's shoulder), else the first allowed;
     * null = personal scope.
     *
     * @param  Collection<int, Division>  $allowed
     */
    public function resolveDivision(User $viewer, DashboardRole $role, Collection $allowed, ?string $requested): ?Division
    {
        if ($allowed->isEmpty()) {
            return null;
        }

        return ($requested !== null ? $allowed->firstWhere('id', $requested) : null)
            ?? ($viewer->division_id !== null ? $allowed->firstWhere('id', $viewer->division_id) : null)
            ?? $allowed->firstWhere('id', $this->holderDivisionId($viewer, $role))
            ?? $allowed->first();
    }

    private function holderDivisionId(User $viewer, DashboardRole $role): ?string
    {
        $id = User::query()
            ->active()
            ->where('company_id', $viewer->company_id)
            ->whereNotNull('division_id')
            ->whereIn('position_id', Position::query()->where('company_id', $viewer->company_id)->where('dashboard_role', $role->value)->select('id'))
            ->orderBy('name')
            ->value('division_id');

        return is_string($id) ? $id : null;
    }

    /**
     * @param  Collection<int, Division>  $allowed
     * @return array<string, mixed>
     */
    public function build(User $viewer, DashboardRole $role, Collection $allowed, ?Division $division, CarbonImmutable $now): array
    {
        $people = $division !== null
            ? $this->access->people($viewer, DashboardView::Division, $allowed, $division, null)->with('division:id,name')->orderBy('name')->get()
            : User::query()->whereKey($viewer->id)->with('division:id,name')->get();
        $ids = array_values($people->modelKeys());
        $filters = new DashboardFilters(Period::resolve(PeriodPreset::Month, null, null, $now), $division);
        $metrics = $this->division->metrics($viewer, $people, $filters, $now);
        $today = $this->attendance->for($people, $now)['counts'];
        $kpis = $metrics['kpis'];
        $completion = $kpis['completion_rate'];
        $onTime = $kpis['on_time_rate'];
        $overdue = $kpis['overdue_tasks'];
        $board = $division !== null ? $this->divisionBoard($viewer, $division) : null;
        $unit = $division->name ?? ($viewer->division_id !== null ? (string) Division::query()->whereKey($viewer->division_id)->value('name') : $role->label());

        return [
            'unit' => $unit,
            'subtitle' => $division !== null ? Blocks::join('Divisi '.$division->name, count($ids).' orang') : 'Data Anda sendiri',
            'primary' => $board !== null ? Blocks::link('Buka board divisi', '/w/'.$board) : Blocks::link('Tugas saya', '/tugas'),
            'secondary' => $division !== null && Gate::forUser($viewer)->allows('viewDashboard', DashboardView::Division)
                ? Blocks::link('Dashboard divisi', '/dashboard/divisi?divisi='.$division->id)
                : null,
            'kpis' => [
                Blocks::kpi('Tugas selesai bulan ini', $completion['value'], $completion['denominator'] > 0
                    ? sprintf('%d dari %d bertenggat bulan ini', $completion['numerator'], $completion['denominator'])
                    : 'Belum ada tugas bertenggat', 'highlight', unit: 'percent'),
                Blocks::kpi('Tugas terlambat', $overdue['value'], $overdue['value'] > 0 ? ($division !== null ? "di {$overdue['people']} orang" : 'lewat tenggat') : 'Semua sesuai tenggat', $overdue['value'] > 0 ? 'warm' : 'plain'),
                Blocks::kpi('Tepat tenggat', $onTime['value'], $onTime['denominator'] > 0
                    ? sprintf('%d dari %d tugas selesai', $onTime['numerator'], $onTime['denominator'])
                    : 'Belum ada tugas selesai bertenggat', unit: 'percent'),
                Blocks::kpi('Hadir hari ini', $today['present'], Blocks::join(
                    Blocks::count($today['late'], 'terlambat'),
                    Blocks::count($today['away'], 'cuti/izin'),
                    Blocks::count($today['not_checked_in'], 'belum check-in'),
                ) ?: ($today['scheduled'] > 0 ? 'Semua sudah check-in' : 'Tidak ada jadwal hari ini'), total: $today['scheduled']),
            ],
            'list' => [
                'title' => 'Tugas terlambat',
                'link' => $board !== null ? Blocks::link('Board divisi', '/w/'.$board) : Blocks::link('Tugas saya', '/tugas'),
                'empty' => 'Tidak ada tugas yang lewat tenggat.',
                'rows' => array_values(array_map(fn (array $task): array => Blocks::row(
                    $task['id'],
                    explode('-', $task['key'])[0],
                    $task['title'],
                    Blocks::join($task['key'], implode(', ', array_map(fn (array $person): string => $person['name'], $task['assignees']))),
                    $task['days_late'] > 0 ? "Terlambat {$task['days_late']} hari" : 'Jatuh tempo',
                    'late',
                    $task['url'],
                ), array_slice($metrics['overdue']['items'], 0, self::OVERDUE_ROWS))),
            ],
            'bars' => [
                'title' => $division !== null ? 'Beban kerja tim' : 'Beban kerja Anda',
                'note' => 'tugas terbuka per orang',
                'empty' => 'Belum ada tugas terbuka.',
                'items' => $this->workloadBars($metrics['workload']),
            ],
            'schedule' => [
                'title' => 'Tenggat terdekat',
                'link' => Blocks::link('Tugas saya', '/tugas'),
                'empty' => 'Tidak ada tenggat dalam 7 hari.',
                'items' => $this->cache->remember('peran', $viewer, 'unit:upcoming', ['today' => Period::officeDate($now)->toDateString(), 'people' => sha1(implode(',', $ids))], fn (): array => $this->upcoming(new MetricScope($viewer, $ids), $now)),
            ],
            'side' => [
                'title' => 'Proyek perlu perhatian',
                'warm' => false,
                'empty' => 'Tidak ada proyek berisiko di unit ini.',
                'items' => array_values(array_map(fn (array $project): array => [
                    'title' => $project['key'].' · '.$project['name'],
                    'meta' => Blocks::join((string) ($project['health_label'] ?? ''), $project['stale'] ? 'update kedaluwarsa' : '', $project['lead'] !== null ? 'PIC '.$project['lead'] : ''),
                    'href' => '/w/'.$project['key'].'/ringkasan',
                ], array_slice($metrics['projects'], 0, 4))),
            ],
            'held' => $role->heldModule(),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $workload
     * @return list<array<string, mixed>>
     */
    private function workloadBars(array $workload): array
    {
        $rows = array_values(array_filter($workload, fn (array $row): bool => $row['open'] > 0));
        $max = max(1, ...array_map(fn (array $row): int => (int) $row['open'], $rows ?: [['open' => 1]]));

        return array_map(fn (array $row): array => Blocks::bar(
            $row['user']['id'],
            $row['user']['name'],
            $row['estimate_hours'] !== null ? '± '.rtrim(rtrim(number_format((float) $row['estimate_hours'], 1, ',', '.'), '0'), ',').' jam estimasi' : 'tanpa estimasi jam',
            $row['open'] / $max * 100,
            null,
            Blocks::join($row['open'].' terbuka', Blocks::count((int) $row['overdue'], 'terlambat')),
            $row['overdue'] > 0 ? 'late' : 'ok',
        ), array_slice($rows, 0, self::WORKLOAD_BARS));
    }

    /**
     * Key of the division workspace (board), when the viewer can see it.
     */
    private function divisionBoard(User $viewer, Division $division): ?string
    {
        $key = Workspace::query()
            ->visibleTo($viewer)
            ->notArchived()
            ->where('type', WorkspaceType::Division->value)
            ->where('division_id', $division->id)
            ->value('key');

        return is_string($key) ? $key : null;
    }

    /**
     * Open tasks of the people due today … +7 days.
     *
     * @return list<array<string, mixed>>
     */
    private function upcoming(MetricScope $scope, CarbonImmutable $now): array
    {
        $today = Period::officeDate($now);

        return array_values($scope->tasks()
            ->whereNotIn('tasks.status_category', TaskStatusCategory::closedValues())
            ->whereNotNull('tasks.due_date')
            ->where('tasks.due_date', '>=', $today->toDateString())
            ->where('tasks.due_date', '<', $today->addDays(self::UPCOMING_DAYS + 1)->toDateString())
            ->with('workspace:id,key,name')
            ->orderBy('tasks.due_date')
            ->orderBy('tasks.priority')
            ->limit(self::UPCOMING_ROWS)
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.due_date', 'tasks.priority'])
            ->map(function (Task $task): array {
                $key = $task->workspace->key.'-'.$task->number;

                return Blocks::event($task->id, (string) $task->due_date?->toDateString(), $task->title, 'task', $key, '/w/'.$task->workspace->key.'?q='.rawurlencode($key));
            })
            ->all());
    }
}
