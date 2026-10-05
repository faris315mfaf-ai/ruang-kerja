<?php

namespace App\Domain\Analytics\Exports;

use App\Support\Excel\BindsValuesSafely;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

/**
 * One worksheet of the dashboard export.
 */
final readonly class DashboardSheet implements FromArray, ShouldAutoSize, WithCustomValueBinder, WithHeadings, WithTitle
{
    use BindsValuesSafely;

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
