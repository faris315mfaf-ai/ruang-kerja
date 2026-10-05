<?php

namespace App\Domain\Analytics\Exports;

use Maatwebsite\Excel\Concerns\Export;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Excel export of what a dashboard shows (PROMPTS Sprint 9 task 6).
 */
final readonly class DashboardExport implements Export, WithMultipleSheets
{
    /**
     * @param  list<DashboardSheet>  $sheets
     */
    public function __construct(private array $sheets) {}

    /**
     * @return list<DashboardSheet>
     */
    public function sheets(): array
    {
        return $this->sheets;
    }
}
