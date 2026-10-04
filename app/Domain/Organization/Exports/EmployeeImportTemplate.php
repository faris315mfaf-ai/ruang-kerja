<?php

namespace App\Domain\Organization\Exports;

use App\Domain\Organization\Imports\EmployeeImportValidator;
use App\Models\Company;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithHeadings;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

/**
 * Downloadable template for the employee import (CSV or XLSX) with one example row.
 */
final readonly class EmployeeImportTemplate implements FromArray, WithColumnFormatting, WithHeadings
{
    public function __construct(private Company $company) {}

    /**
     * @return list<string>
     */
    public function headings(): array
    {
        return EmployeeImportValidator::COLUMNS;
    }

    /**
     * @return list<list<string>>
     */
    public function array(): array
    {
        return [[
            'Bayu Saputra',
            "bayu.saputra@{$this->company->google_domain}",
            'RK-0100',
            'OPS',
            '',
            'Staf Operasional',
            '',
            'Hybrid',
            'anggota',
            '2026-01-15',
            '+62 812 0000 0000',
            '',
        ]];
    }

    /**
     * Keep long numbers (employee number, phone, NIK) as text in Excel.
     *
     * @return array<string, string>
     */
    public function columnFormats(): array
    {
        return [
            'C' => NumberFormat::FORMAT_TEXT,
            'J' => NumberFormat::FORMAT_DATE_YYYYMMDD,
            'K' => NumberFormat::FORMAT_TEXT,
            'L' => NumberFormat::FORMAT_TEXT,
        ];
    }
}
