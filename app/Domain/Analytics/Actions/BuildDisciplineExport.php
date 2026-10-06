<?php

namespace App\Domain\Analytics\Actions;

use App\Domain\Analytics\Data\DashboardContext;
use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Analytics\Exports\DashboardSheet;
use App\Domain\Analytics\MetricDefinitions\MetricCatalog;
use App\Domain\Analytics\Queries\AttendanceDisciplineReport;
use App\Domain\Attendance\Support\OfficeClock;
use Carbon\CarbonImmutable;

/**
 * Excel of Absensi › Kedisiplinan from the same query as the page (same
 * layout as the dashboard exports): "Ringkasan" with every KPI, previous
 * period, delta and definition, then the 8-week trend and the per-person table.
 */
final class BuildDisciplineExport
{
    public function __construct(private readonly AttendanceDisciplineReport $report) {}

    public function handle(DashboardContext $context, CarbonImmutable $now): DashboardExport
    {
        $report = $this->report->build($context->viewer, $context->people, $context->filters, $now);
        $kpis = $report['kpis'];
        $definitions = MetricCatalog::definitions();
        $row = fn (string $key, string $label, string $unit, string $definition): array => [
            $label, $kpis[$key]['value'], $kpis[$key]['previous'], $kpis[$key]['delta'], $unit, $definition,
        ];

        $summary = [
            ['Laporan', 'Kedisiplinan & penyelesaian'],
            ['Cakupan', $context->scopeLabel().' ('.$context->people->count().' orang)'],
            ['Periode', $report['period']['label'].' (dihitung '.$report['compared']['current']['label'].')'],
            ['Dibandingkan dengan', $report['compared']['previous']['label']],
            ['Diekspor', OfficeClock::date($now).' '.OfficeClock::time($now)],
            [],
            ['Metrik', 'Nilai', 'Periode lalu', 'Selisih', 'Satuan', 'Definisi'],
            $row('attendance_discipline', $definitions['attendance_discipline']['label'], '%', $definitions['attendance_discipline']['definition']),
            $row('average_lateness', $definitions['average_lateness']['label'], 'menit', $definitions['average_lateness']['definition']),
            $row('absent_days', 'Hari alpha', 'hari', 'Hari berstatus Alpha dalam periode.'),
            $row('late_days', 'Hari terlambat', 'hari', 'Hari berstatus Terlambat dalam periode.'),
            $row('completion_rate', $definitions['completion_rate']['label'], '%', $definitions['completion_rate']['definition']),
            $row('lead_time', $definitions['lead_time']['label'], 'hari', $definitions['lead_time']['definition']),
        ];

        return new DashboardExport([
            new DashboardSheet('Ringkasan', [], $summary),
            new DashboardSheet('Tren kedisiplinan', ['Minggu mulai', 'Kedisiplinan hadir (%)', 'Tepat waktu', 'Hari terjadwal'], array_map(
                fn (array $week): array => [$week['week_start'], $week['value'], $week['numerator'], $week['denominator']],
                $report['trend'],
            )),
            new DashboardSheet('Per orang', ['Nama', 'Divisi', 'Hari terjadwal', 'Tepat waktu', 'Kedisiplinan (%)', 'Hari terlambat', 'Rata-rata terlambat (menit)', 'Hari alpha'], array_map(
                fn (array $person): array => [
                    $person['user']['name'], $person['user']['division'], $person['scheduled'], $person['on_time'],
                    $person['discipline'], $person['late_days'], $person['average_late'], $person['absent_days'],
                ],
                $report['people'],
            )),
        ]);
    }

    public static function filename(CarbonImmutable $now): string
    {
        return 'kedisiplinan-'.OfficeClock::local($now)->format('Y-m-d').'.xlsx';
    }
}
