<?php

namespace App\Domain\Payroll\Exports;

use App\Domain\Payroll\Data\PayrollReport;
use App\Support\Excel\BindsValuesSafely;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Absensi › Gaji › Ekspor: one row per employee of PayrollCalculator.
 */
final class DailyPayrollExport implements FromArray, ShouldAutoSize, WithColumnFormatting, WithCustomValueBinder, WithHeadings, WithStyles, WithTitle
{
    use BindsValuesSafely;

    public function __construct(private readonly PayrollReport $report) {}

    /**
     * @return list<string>
     */
    public function headings(): array
    {
        return ['No. karyawan', 'Nama', 'Divisi', 'Jabatan', 'Upah harian', 'Hadir', 'Cuti/Sakit/Izin dibayar', 'Tidak dibayar', 'Alpha', 'Terlambat', 'Belum dihitung', 'Hari dibayar', 'Potongan', 'Total'];
    }

    /**
     * @return list<list<string|int|float|null>>
     */
    public function array(): array
    {
        return array_map(fn (array $row): array => [
            $row['employee_number'],
            $row['name'],
            $row['division'],
            $row['position'],
            $row['daily_wage'],
            $row['present_days'],
            $row['paid_leave_days'],
            $row['unpaid_days'],
            $row['absent_days'],
            $row['late_count'],
            $row['pending_days'],
            $row['paid_days'],
            $row['deduction'],
            $row['total'],
        ], $this->report->rows);
    }

    public function title(): string
    {
        return 'Gaji '.($this->report->period['label'] ?? '');
    }

    /**
     * @return array<string, string>
     */
    public function columnFormats(): array
    {
        return [
            'A' => NumberFormat::FORMAT_TEXT,
            'E' => '#,##0',
            'M' => '#,##0',
            'N' => '#,##0',
        ];
    }

    /**
     * @return array<int, array<string, array<string, bool>>>
     */
    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }

    public static function filename(PayrollReport $report): string
    {
        return 'gaji-harian-'.($report->period['month'] ?? 'bulan').'.xlsx';
    }
}
