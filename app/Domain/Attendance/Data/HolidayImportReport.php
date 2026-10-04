<?php

namespace App\Domain\Attendance\Data;

/**
 * Result of a holiday CSV import. When `errors` is not empty nothing was saved.
 */
final class HolidayImportReport
{
    public int $created = 0;

    public int $updated = 0;

    /** @var list<array{line: int, message: string}> */
    public array $errors = [];

    public function failed(): bool
    {
        return $this->errors !== [];
    }

    public function addError(int $line, string $message): void
    {
        $this->errors[] = ['line' => $line, 'message' => $message];
    }
}
