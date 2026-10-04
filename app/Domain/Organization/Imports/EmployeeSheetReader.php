<?php

namespace App\Domain\Organization\Imports;

use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Row;

/**
 * Reads an employee CSV/XLSX in chunks of 500 rows (PhpSpreadsheet keeps only one
 * chunk in memory). Headings are slugged ("Atasan Email" → atasan_email); values
 * are normalized to trimmed strings keyed by the sheet row number (heading = 1).
 *
 * Rows are kept in memory only for the duration of a request; they are never
 * cached or logged (they may contain NIK).
 */
final class EmployeeSheetReader implements OnEachRow, SkipsEmptyRows, WithChunkReading, WithHeadingRow
{
    public const int MAX_ROWS = 2000;

    /** @var array<int, array<string, string|null>> */
    private array $rows = [];

    private bool $truncated = false;

    public function onRow(Row $row): void
    {
        if (count($this->rows) >= self::MAX_ROWS) {
            $this->truncated = true;

            return;
        }

        $values = [];

        foreach ($row->toArray(null, false, false) as $key => $value) {
            if (is_string($key) && $key !== '') {
                $values[$key] = self::normalize($value);
            }
        }

        $this->rows[$row->getIndex()] = $values;
    }

    public function chunkSize(): int
    {
        return 500;
    }

    /**
     * @return array<int, array<string, string|null>>
     */
    public function rows(): array
    {
        return $this->rows;
    }

    public function truncated(): bool
    {
        return $this->truncated;
    }

    private static function normalize(mixed $value): ?string
    {
        $string = match (true) {
            $value === null => '',
            is_string($value) => $value,
            // Long numbers typed into Excel (NIK, phone) arrive as floats.
            is_float($value) => floor($value) === $value ? sprintf('%.0f', $value) : (string) $value,
            is_int($value) => (string) $value,
            is_bool($value) => $value ? '1' : '0',
            $value instanceof \DateTimeInterface => $value->format('Y-m-d'),
            default => '',
        };

        $string = trim(preg_replace('/^\x{FEFF}/u', '', $string) ?? '');

        return $string === '' ? null : $string;
    }
}
