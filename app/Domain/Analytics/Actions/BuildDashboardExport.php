<?php

namespace App\Domain\Analytics\Actions;

use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Analytics\Exports\DashboardSheet;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\Queries\DivisionDashboard;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Analytics\Queries\PersonalDashboard;
use App\Domain\Attendance\Support\OfficeClock;
use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Domain\Monitoring\Queries\ProjectWorkMonitor;
use App\Domain\Monitoring\Queries\WeeklyWorkMonitor;
use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Planner\Queries\PersonalPlanner;
use Carbon\CarbonImmutable;

/**
 * Builds the Excel export of a dashboard view from the same queries the page
 * uses, so the file always matches the screen: a "Ringkasan" sheet (scope,
 * period, every KPI with its previous period, delta and definition) followed
 * by one sheet per dashboard block.
 */
final class BuildDashboardExport
{
    private const array KPI_HEADINGS = ['Metrik', 'Nilai', 'Periode lalu', 'Selisih', 'Satuan', 'Definisi'];

    public function __construct(
        private readonly PersonalDashboard $personal,
        private readonly DivisionDashboard $division,
        private readonly HrDashboard $hr,
        private readonly PersonalPlanner $planner,
        private readonly DailyWorkMonitor $daily,
        private readonly WeeklyWorkMonitor $weekly,
        private readonly ProjectWorkMonitor $projects,
    ) {}

    public function handle(DashboardContext $context, CarbonImmutable $now): DashboardExport
    {
        return new DashboardExport(match ($context->view) {
            DashboardView::Personal => $this->personalSheets($context, $now),
            DashboardView::Division => $this->divisionSheets($context, $now),
            DashboardView::Hr => $this->hrSheets($context, $now),
            DashboardView::Direksi => $this->direksiSheets($context, $now),
        });
    }

    public static function filename(DashboardView $view, CarbonImmutable $now): string
    {
        return 'dashboard-'.$view->value.'-'.OfficeClock::local($now)->format('Y-m-d').'.xlsx';
    }

    /**
     * @return list<DashboardSheet>
     */
    private function personalSheets(DashboardContext $context, CarbonImmutable $now): array
    {
        $metrics = $this->personal->metrics($context->viewer, $context->filters, $now);
        $live = $this->personal->live($context->viewer, $now);
        $kpis = $metrics['kpis'];

        $rows = [
            ['Tugas terbuka', $kpis['open_tasks']['value'], null, null, 'tugas', 'Tugas saya yang belum Selesai/Dibatalkan.'],
            $this->kpi('overdue_tasks', $kpis['open_tasks']['overdue']),
            ['Tugas selesai', $kpis['completed']['value'], $kpis['completed']['previous'], $kpis['completed']['delta'], 'tugas', 'Tugas saya yang masuk Selesai dalam periode.'],
            $this->kpi('on_time_rate', $kpis['on_time_rate']),
            $this->kpi('completion_rate', $kpis['completion_rate']),
            $this->kpi('lead_time', $kpis['lead_time']),
            $this->kpi('attendance_discipline', $metrics['attendance']['attendance_discipline']),
            $this->kpi('average_lateness', $metrics['attendance']['average_lateness']),
        ];

        if ($live['leave_balance'] !== null) {
            $rows[] = ['Saldo cuti ('.$live['leave_balance']['type'].')', $live['leave_balance']['remaining'], null, null, 'hari', 'Sisa setelah cuti yang disetujui, berlaku s.d. 31 Des '.$live['leave_balance']['year'].'.'];
        }

        return [
            $this->summary($context, $metrics['period'], $metrics['compared'], $now, $rows),
            $this->plannerSheet($this->planner->for($context->viewer, $now)),
            new DashboardSheet('Kehadiran', ['Tanggal', 'Status', 'Terlambat (menit)'], array_map(
                fn (array $day): array => [$day['date'], $day['label'], $day['late_minutes'] ?: null],
                $metrics['attendance']['days']['items'],
            )),
            new DashboardSheet('Pengajuan', ['Nomor', 'Jenis', 'Status', 'Mulai', 'Selesai'], array_map(
                fn (array $request): array => [$request['number'], $request['type']['name'], $request['status_label'], self::date($request['start_at']), self::date($request['end_at'])],
                $live['requests'],
            )),
        ];
    }

    /**
     * "Ruang saya": open tasks per lane (the viewer's own plan), new assignments first.
     *
     * @param  array{incoming: list<array<string, mixed>>, lanes: array<string, list<array<string, mixed>>>}  $planner
     */
    private function plannerSheet(array $planner): DashboardSheet
    {
        $rows = array_map(fn (array $task): array => ['Tugas baru', ...self::plannerTask($task), 'Ditugaskan '.($task['assigned_by'] ?? '')], $planner['incoming']);

        foreach (PlanBucket::cases() as $bucket) {
            foreach ($planner['lanes'][$bucket->value] as $task) {
                if ($task['done'] !== true) {
                    $rows[] = [$bucket->label(), ...self::plannerTask($task), $task['status']['name'] ?? null];
                }
            }
        }

        return new DashboardSheet('Ruang saya', ['Rencana', 'Tugas', 'Judul', 'Workspace', 'Tenggat', 'Terlambat (hari)', 'Status'], $rows);
    }

    /**
     * @param  array<string, mixed>  $task
     * @return list<mixed>
     */
    private static function plannerTask(array $task): array
    {
        return [$task['key'], $task['title'], $task['workspace']['name'] ?? null, $task['due_date'], $task['days_late'] ?: null];
    }

    /**
     * @return list<DashboardSheet>
     */
    private function divisionSheets(DashboardContext $context, CarbonImmutable $now): array
    {
        $metrics = $this->division->metrics($context->viewer, $context->people, $context->filters, $now);
        $today = $this->division->today($context->people, $now);
        $kpis = $metrics['kpis'];

        $rows = [
            ['Kehadiran hari ini', $today['counts']['present'], null, null, 'orang', 'Hadir (termasuk terlambat) dari '.$today['counts']['scheduled'].' terjadwal.'],
            $this->kpi('completion_rate', $kpis['completion_rate']),
            $this->kpi('on_time_rate', $kpis['on_time_rate']),
            $this->kpi('overdue_tasks', $kpis['overdue_tasks']['value']),
            $this->kpi('lead_time', $kpis['lead_time']),
            $this->kpi('attendance_discipline', $kpis['attendance_discipline']),
            $this->kpi('average_lateness', $kpis['average_lateness']),
        ];

        return [
            $this->summary($context, $metrics['period'], $metrics['compared'], $now, $rows),
            new DashboardSheet('Tren 8 minggu', ['Minggu mulai', 'Tingkat penyelesaian (%)', 'Selesai', 'Bertenggat'], array_map(
                fn (array $week): array => [$week['week_start'], $week['value'], $week['numerator'], $week['denominator']],
                $metrics['trend'],
            )),
            new DashboardSheet('Beban kerja', ['Nama', 'Tugas terbuka', 'Terlambat', 'Estimasi (jam)'], array_map(
                fn (array $row): array => [$row['user']['name'], $row['open'], $row['overdue'], $row['estimate_hours']],
                $metrics['workload'],
            )),
            new DashboardSheet('Tugas terlambat', ['Tugas', 'Judul', 'Penanggung jawab', 'Tenggat', 'Terlambat (hari)'], array_map(
                fn (array $task): array => [$task['key'], $task['title'], implode(', ', array_column($task['assignees'], 'name')), $task['due_date'], $task['days_late']],
                $metrics['overdue']['items'],
            )),
            $this->todaySheet($today['people']),
            new DashboardSheet('Proyek berisiko', ['Key', 'Proyek', 'Status PIC', 'Update terakhir', 'Target', 'PIC'], array_map(
                fn (array $project): array => [$project['key'], $project['name'], $project['health_label'] ?? ($project['stale'] ? 'Update kedaluwarsa' : null), self::date($project['last_update_at']), $project['target_date'], $project['lead']],
                $metrics['projects'],
            )),
        ];
    }

    /**
     * HR dashboard since the owner's decision of 6 Okt 2026: today's
     * attendance numbers and the requests waiting for HR (the attendance
     * lists and the discipline recap are exported from Absensi).
     *
     * @return list<DashboardSheet>
     */
    private function hrSheets(DashboardContext $context, CarbonImmutable $now): array
    {
        $ids = $context->userIds();
        $today = $this->hr->attendanceSummary($context->viewer, $context->people, $now);
        $pending = $this->hr->pendingHr($ids);
        $counts = $today['counts'];

        $rows = [
            ['Terjadwal hari ini', $counts['scheduled'], null, null, 'orang', 'Karyawan dengan jadwal kerja hari ini.'],
            ['Hadir hari ini', $counts['present'], null, null, 'orang', 'Termasuk '.$counts['late'].' terlambat.'],
            ['Cuti/izin/sakit/dinas', $counts['away'], null, null, 'orang', 'Dari pengajuan yang disetujui.'],
            ['Belum check-in', $counts['not_checked_in'], null, null, 'orang', 'Terjadwal tetapi belum check-in.'],
            ['Perlu ditinjau', $today['review_count'], null, null, 'absensi', 'Absensi tidak biasa 7 hari terakhir yang belum ditinjau (Absensi › Hari ini).'],
            ['Lupa check-out kemarin', $today['missing_check_out_count'], null, null, 'orang', 'Check-in kemarin tanpa check-out (Absensi › Hari ini).'],
            ['Pengajuan menunggu HR', $pending['count'], null, null, 'pengajuan', 'Langkah persetujuan yang sedang menunggu HR.'],
        ];
        $summary = [
            ['Dashboard', $context->view->label()],
            ['Cakupan', $context->scopeLabel().' ('.$context->people->count().' orang)'],
            ['Tanggal', OfficeClock::date($now)],
            ['Diekspor', OfficeClock::date($now).' '.OfficeClock::time($now)],
            [],
            self::KPI_HEADINGS,
            ...$rows,
        ];

        return [
            new DashboardSheet('Ringkasan', [], $summary),
            new DashboardSheet('Menunggu HR', ['Nomor', 'Nama', 'Jenis', 'Mulai', 'Selesai'], array_map(
                fn (array $request): array => [$request['number'], $request['user']['name'], $request['type']['name'], self::date($request['start_at']), self::date($request['end_at'])],
                $pending['items'],
            )),
        ];
    }

    /**
     * Direksi work monitoring (keputusan pemilik 6 Okt 2026): today's daily
     * reports per division, the reports, this week's matrix and the projects.
     *
     * @return list<DashboardSheet>
     */
    private function direksiSheets(DashboardContext $context, CarbonImmutable $now): array
    {
        $today = Period::officeDate($now);
        $monday = WeeklyWorkMonitor::weekStart($today);
        $daily = $this->daily->for($context->viewer, $context->people, $today, $now);
        $weekly = $this->weekly->for($context->viewer, $context->people, $monday, $now);
        $projects = $this->projects->for($context->viewer, $monday);
        $totals = $daily['totals'];

        $summary = [
            ['Dashboard', $context->view->label()],
            ['Cakupan', $context->scopeLabel().' ('.$context->people->count().' orang)'],
            ['Tanggal', OfficeClock::date($now)],
            ['Minggu', $weekly['week']['label']],
            ['Diekspor', OfficeClock::date($now).' '.OfficeClock::time($now)],
            [],
            ['Ringkasan', 'Nilai'],
            ['Terjadwal hari ini', $totals['scheduled']],
            ['Sudah lapor', $totals['reported']],
            ['Draf', $totals['draft']],
            ['Belum lapor', $totals['missing']],
            ['Laporan minggu ini', $weekly['totals']['reported'].' dari '.$weekly['totals']['expected'].' hari kerja'],
            ['Jam tercatat minggu ini', $weekly['totals']['hours']],
            ['Proyek aktif', $projects['total']],
        ];
        $weekRows = [];

        foreach ($weekly['divisions'] as $division) {
            foreach ($division['people'] as $person) {
                $weekRows[] = [
                    $division['name'],
                    $person['user']['name'],
                    ...array_map(fn (array $cell): string => match ($cell['state']) {
                        'reported' => 'Lapor ('.$cell['items'].' tugas'.($cell['hours'] !== null ? ', '.$cell['hours'].' jam' : '').')',
                        'draft' => 'Draf',
                        'missing' => 'Belum',
                        'future' => '',
                        default => 'Libur',
                    }, $person['days']),
                    $person['reported_days'].'/'.$person['scheduled_days'],
                    $person['hours'],
                ];
            }
        }

        return [
            new DashboardSheet('Ringkasan', [], $summary),
            new DashboardSheet('Harian per divisi', ['Divisi', 'Orang', 'Terjadwal', 'Sudah lapor', 'Draf', 'Belum lapor'], array_map(
                fn (array $row): array => [$row['name'], $row['people'], $row['scheduled'], $row['reported'], $row['draft'], $row['missing']],
                $daily['divisions'],
            )),
            new DashboardSheet('Laporan hari ini', ['Nama', 'Divisi', 'Dikirim', 'Ringkasan', 'Tugas', 'Jam', 'Hambatan'], array_map(
                fn (array $report): array => [
                    $report['user']['name'],
                    $report['user']['division'],
                    self::time($report['submitted_at']),
                    $report['summary'],
                    implode('; ', array_map(fn (array $item): string => trim(($item['key'] ?? '').' '.($item['title'] ?? '').($item['percent'] !== null ? ' ('.$item['percent'].'%)' : '')), $report['items'])),
                    $report['hours'],
                    $report['blockers'],
                ],
                $daily['reports'],
            )),
            new DashboardSheet('Mingguan', ['Divisi', 'Nama', ...array_column($weekly['days'], 'label'), 'Hari lapor', 'Jam'], $weekRows),
            new DashboardSheet('Proyek', ['Key', 'Proyek', 'Status PIC', 'Progres aktual (%)', 'Rencana (%)', 'Milestone berikutnya', 'Laporan minggu ini', 'Orang'], array_map(
                fn (array $project): array => [
                    $project['key'],
                    $project['name'],
                    $project['health'],
                    $project['metrics']['actual'],
                    $project['metrics']['planned'],
                    $project['next_milestone'] !== null ? $project['next_milestone']['name'].' ('.$project['next_milestone']['target_date'].')' : null,
                    $project['week']['reports'],
                    $project['week']['people'],
                ],
                $projects['projects'],
            )),
        ];
    }

    /**
     * @param  array{label: string}  $period
     * @param  array{current: array{label: string}, previous: array{label: string}}  $compared
     * @param  array<int, array<int, mixed>>  $kpis
     */
    private function summary(DashboardContext $context, array $period, array $compared, CarbonImmutable $now, array $kpis): DashboardSheet
    {
        $rows = [
            ['Dashboard', $context->view->label()],
            ['Cakupan', $context->view === DashboardView::Personal ? $context->viewer->name : $context->scopeLabel().' ('.$context->people->count().' orang)'],
            ['Periode', $period['label'].' (dihitung '.$compared['current']['label'].')'],
            ['Dibandingkan dengan', $compared['previous']['label']],
            ['Diekspor', OfficeClock::date($now).' '.OfficeClock::time($now)],
            [],
            self::KPI_HEADINGS,
            ...$kpis,
        ];

        return new DashboardSheet('Ringkasan', [], $rows);
    }

    /**
     * @param  array{value: float|null, previous: float|null, delta: float|null}|int  $value
     * @return array<int, mixed>
     */
    private function kpi(string $key, array|int $value): array
    {
        $definition = MetricCatalog::definitions()[$key];
        $unit = match ($definition['unit']) {
            'percent' => '%',
            'days' => 'hari',
            'minutes' => 'menit',
            default => 'tugas',
        };

        if (is_int($value)) {
            return [$definition['label'], $value, null, null, $unit, $definition['definition']];
        }

        return [$definition['label'], $value['value'], $value['previous'], $value['delta'], $unit, $definition['definition']];
    }

    /**
     * @param  list<array<string, mixed>>  $people
     */
    private function todaySheet(array $people): DashboardSheet
    {
        $states = ['present' => 'Hadir', 'late' => 'Terlambat', 'away' => 'Cuti/izin/sakit', 'not_checked_in' => 'Belum check-in', 'absent' => 'Alpha'];

        return new DashboardSheet('Kehadiran hari ini', ['Nama', 'Divisi', 'Keadaan', 'Status', 'Masuk', 'Terlambat (menit)'], array_map(
            fn (array $person): array => [
                $person['user']['name'],
                $person['user']['division'],
                $states[$person['state']] ?? $person['state'],
                $person['request_type'] ?? $person['status_label'],
                self::time($person['check_in_at']),
                $person['late_minutes'] ?: null,
            ],
            $people,
        ));
    }

    private static function date(mixed $iso): ?string
    {
        return is_string($iso) ? OfficeClock::date(CarbonImmutable::parse($iso)) : null;
    }

    private static function time(mixed $iso): ?string
    {
        return is_string($iso) ? OfficeClock::time(CarbonImmutable::parse($iso)) : null;
    }
}
