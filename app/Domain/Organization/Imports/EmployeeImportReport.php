<?php

namespace App\Domain\Organization\Imports;

/**
 * Result of validating (dry-run) or committing an employee import.
 */
final class EmployeeImportReport
{
    /**
     * @param  list<EmployeeImportRow>  $rows
     * @param  list<string>  $fileErrors  problems with the whole file (missing columns, too many rows)
     */
    public function __construct(
        public array $rows = [],
        public array $fileErrors = [],
        public int $created = 0,
        public int $updated = 0,
    ) {}

    /**
     * @return list<EmployeeImportRow>
     */
    public function validRows(): array
    {
        return array_values(array_filter($this->rows, fn (EmployeeImportRow $row): bool => $row->valid()));
    }

    /**
     * @return array{total: int, create: int, update: int, error: int}
     */
    public function summary(): array
    {
        $create = $update = $error = 0;

        foreach ($this->rows as $row) {
            match ($row->action()) {
                EmployeeImportRow::CREATE => $create++,
                EmployeeImportRow::UPDATE => $update++,
                default => $error++,
            };
        }

        return ['total' => count($this->rows), 'create' => $create, 'update' => $update, 'error' => $error];
    }

    /**
     * @return array{summary: array{total: int, create: int, update: int, error: int}, fileErrors: list<string>, rows: list<array{row: int, name: string|null, email: string|null, action: string, errors: list<string>}>, created: int, updated: int}
     */
    public function toArray(): array
    {
        return [
            'summary' => $this->summary(),
            'fileErrors' => $this->fileErrors,
            'rows' => array_map(fn (EmployeeImportRow $row): array => $row->toArray(), $this->rows),
            'created' => $this->created,
            'updated' => $this->updated,
        ];
    }
}
