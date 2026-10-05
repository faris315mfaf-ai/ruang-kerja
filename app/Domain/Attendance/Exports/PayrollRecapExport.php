<?php

namespace App\Domain\Attendance\Exports;

use App\Domain\Attendance\Data\EmployeeRecap;
use App\Domain\Attendance\Data\RecapReport;
use App\Domain\Attendance\Enums\PayrollColumn;
use App\Support\Excel\BindsValuesSafely;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Payroll-ready Excel of the monthly recap; columns from
 * config/payroll_export.php (PayrollColumn).
 */
final class PayrollRecapExport implements FromArray, ShouldAutoSize, WithColumnFormatting, WithCustomValueBinder, WithHeadings, WithStyles, WithTitle
{
    use BindsValuesSafely;

    /** @var list<array{0: PayrollColumn, 1: string}> */
    private array $columns;

    public function __construct(private readonly RecapReport $report)
    {
        $this->columns = PayrollColumn::configured();
    }

    /**
     * @return list<string>
     */
    public function headings(): array
    {
        return array_map(fn (array $column): string => $column[1], $this->columns);
    }

    /**
     * @return list<list<string|int|float|null>>
     */
    public function array(): array
    {
        return array_map(
            fn (EmployeeRecap $row): array => array_map(fn (array $column): string|int|float|null => $column[0]->value($row), $this->columns),
            $this->report->rows,
        );
    }

    public function title(): string
    {
        return Str::limit(str_replace('{month}', $this->report->period->label(), config()->string('payroll_export.sheet_title')), 31, '');
    }

    /**
     * Text columns (employee number) stay text in Excel.
     *
     * @return array<string, string>
     */
    public function columnFormats(): array
    {
        $formats = [];

        foreach ($this->columns as $index => [$column]) {
            $formats[Coordinate::stringFromColumnIndex($index + 1)] = $column->isText() ? NumberFormat::FORMAT_TEXT : NumberFormat::FORMAT_GENERAL;
        }

        return $formats;
    }

    /**
     * @return array<int, array<string, array<string, bool>>>
     */
    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }

    public static function filename(RecapReport $report, string $extension): string
    {
        return str_replace('{month}', $report->period->key(), config()->string('payroll_export.filename')).'.'.$extension;
    }
}
