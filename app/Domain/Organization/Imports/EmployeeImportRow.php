<?php

namespace App\Domain\Organization\Imports;

use App\Domain\Organization\Data\EmployeeData;

/**
 * One validated data row of an employee import (row = sheet row number).
 */
final class EmployeeImportRow
{
    public const string CREATE = 'create';

    public const string UPDATE = 'update';

    public const string ERROR = 'error';

    /**
     * @param  list<string>  $errors
     */
    public function __construct(
        public readonly int $row,
        public readonly ?string $name,
        public readonly ?string $email,
        public array $errors = [],
        public ?EmployeeData $data = null,
        public ?string $existingId = null,
        public ?string $managerEmail = null,
    ) {}

    public function fail(string $message): void
    {
        $this->errors[] = $message;
    }

    public function valid(): bool
    {
        return $this->errors === [] && $this->data !== null;
    }

    public function action(): string
    {
        if (! $this->valid()) {
            return self::ERROR;
        }

        return $this->existingId === null ? self::CREATE : self::UPDATE;
    }

    /**
     * Safe for the client: no NIK, phone or other profile values.
     *
     * @return array{row: int, name: string|null, email: string|null, action: string, errors: list<string>}
     */
    public function toArray(): array
    {
        return [
            'row' => $this->row,
            'name' => $this->name,
            'email' => $this->email,
            'action' => $this->action(),
            'errors' => $this->errors,
        ];
    }
}
