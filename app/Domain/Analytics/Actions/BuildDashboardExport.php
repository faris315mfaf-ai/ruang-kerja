<?php

namespace App\Domain\Analytics\Actions;

use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Analytics\Exports\DashboardSheet;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\Queries\DivisionDashboard;
use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Analytics\Queries\PersonalDashboard;
use App\Domain\Attendance\Support\OfficeClock;
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
    ) {}

    public function handle(DashboardContext $context, CarbonImmutable $now): DashboardExport
    {
        return new DashboardExport(match ($context->view) {
            DashboardView::Personal => $this->personalSheets($context, $now),
            DashboardView::Division => $this->divisionSheets($context, $now),
            DashboardView::Hr => $this->hrSheets($context, $now),
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
            new DashboardSheet('Fokus', ['Tugas', 'Judul', 'Workspace', 'Tenggat', 'Terlambat (hari)'], array_map(
                fn (array $task): array => [$task['key'], $task['title'], $task['workspace'], $task['due_date'], $task['days_late'] ?: null],
                $live['focus']['items'],
            )),
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
     * @return list<DashboardSheet>
     */
    private function hrSheets(DashboardContext $context, CarbonImmutable $now): array
    {
        $ids = $context->userIds();
        $recap = $this->hr->recap($context->viewer, $ids, $context->filters, $now);
        $today = $this->hr->today($context->people, $now);
        $review = $this->hr->review($context->viewer, $ids, $now);
        $pending = $this->hr->pendingHr($ids);
        $missing = $this->hr->missingCheckOut($ids, $now);
        $counts = $today['counts'];
        $kpis = $recap['kpis'];

        $rows = [
            ['Terjadwal hari ini', $counts['scheduled'], null, null, 'orang', 'Karyawan dengan jadwal kerja hari ini.'],
            ['Hadir hari ini', $counts['present'], null, null, 'orang', 'Termasuk '.$counts['late'].' terlambat.'],
            ['Cuti/izin/sakit/dinas', $counts['away'], null, null, 'orang', 'Dari pengajuan yang disetujui.'],
            ['Belum check-in', $counts['not_checked_in'], null, null, 'orang', 'Terjadwal tetapi belum check-in.'],
            $this->kpi('attendance_discipline', $kpis['attendance_discipline']),
            $this->kpi('average_lateness', $kpis['average_lateness']),
            ['Hari alpha', $kpis['absent_days']['value'], $kpis['absent_days']['previous'], $kpis['absent_days']['delta'], 'hari', 'Hari berstatus Alpha dalam periode.'],
            ['Hari terlambat', $kpis['late_days']['value'], $kpis['late_days']['previous'], $kpis['late_days']['delta'], 'hari', 'Hari berstatus Terlambat dalam periode.'],
        ];

        return [
            $this->summary($context, $recap['period'], $recap['compared'], $now, $rows),
            new DashboardSheet('Per divisi', ['Divisi', 'Terjadwal', 'Hadir', 'Terlambat', 'Cuti/izin/sakit', 'Belum check-in', 'Alpha'], array_map(
                fn (array $row): array => [$row['name'], $row['scheduled'], $row['present'], $row['late'], $row['away'], $row['not_checked_in'], $row['absent']],
                $today['divisions'],
            )),
            $this->todaySheet($today['people']),
            new DashboardSheet('Tren kedisiplinan', ['Minggu mulai', 'Kedisiplinan hadir (%)', 'Tepat waktu', 'Hari terjadwal'], array_map(
                fn (array $week): array => [$week['week_start'], $week['value'], $week['numerator'], $week['denominator']],
                $recap['trend'],
            )),
            new DashboardSheet('Perlu ditinjau', ['Nama', 'Waktu', 'Lokasi', 'Penanda'], array_map(
                fn (array $log): array => [$log['user']['name'], self::dateTime($log['occurred_at']), $log['location'], implode(', ', array_column($log['flags'], 'label'))],
                $review['items'],
            )),
            new DashboardSheet('Menunggu HR', ['Nomor', 'Nama', 'Jenis', 'Mulai', 'Selesai'], array_map(
                fn (array $request): array => [$request['number'], $request['user']['name'], $request['type']['name'], self::date($request['start_at']), self::date($request['end_at'])],
                $pending['items'],
            )),
            new DashboardSheet('Lupa check-out', ['Nama', 'Tanggal', 'Shift', 'Masuk'], array_map(
                fn (array $day): array => [$day['user']['name'], $missing['date'], $day['shift'], self::time($day['check_in_at'])],
                $missing['items'],
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

    private static function dateTime(mixed $iso): ?string
    {
        return is_string($iso) ? OfficeClock::date(CarbonImmutable::parse($iso)).' '.OfficeClock::time(CarbonImmutable::parse($iso)) : null;
    }
}
