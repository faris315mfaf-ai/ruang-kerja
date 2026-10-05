<?php

namespace App\Domain\Analytics\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

/**
 * One worksheet of the dashboard export.
 */
final readonly class DashboardSheet implements FromArray, ShouldAutoSize, WithHeadings, WithTitle
{
    /**
     * @param  list<string>  $headings
     * @param  array<int, array<int, mixed>>  $rows
     */
    public function __construct(
        private string $title,
        private array $headings,
        private array $rows,
    ) {}

    public function title(): string
    {
        return $this->title;
    }

    /**
     * @return list<string>
     */
    public function headings(): array
    {
        return $this->headings;
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    public function array(): array
    {
        return $this->rows;
    }
}
