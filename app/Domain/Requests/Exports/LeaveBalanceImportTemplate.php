<?php

namespace App\Domain\Requests\Exports;

use App\Domain\Requests\Imports\LeaveBalanceImport;
use App\Models\Company;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithHeadings;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

/**
 * Downloadable template for the leave balance import (CSV or XLSX) with example rows.
 */
final readonly class LeaveBalanceImportTemplate implements FromArray, WithColumnFormatting, WithHeadings
{
    public function __construct(private Company $company, private int $year) {}

    /**
     * @return list<string>
     */
    public function headings(): array
    {
        return LeaveBalanceImport::COLUMNS;
    }

    /**
     * @return list<list<string>>
     */
    public function array(): array
    {
        $domain = $this->company->google_domain;
        $year = (string) $this->year;

        return [
            // Opening balance taken over from the previous system.
            ["bayu.saputra@{$domain}", 'CUT', $year, '4', '', '', '', ''],
            // Extra day granted, with its reason (audited).
            ["nadia.putri@{$domain}", 'CUT', $year, '', '', '', '1', 'Kompensasi kerja hari libur nasional'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function columnFormats(): array
    {
        return [
            'C' => NumberFormat::FORMAT_TEXT,
        ];
    }
}
