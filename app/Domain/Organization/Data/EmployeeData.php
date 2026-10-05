<?php

namespace App\Domain\Organization\Data;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use Carbon\CarbonImmutable;

/**
 * Complete input for creating or updating an employee (form and import share it).
 *
 * `nik` is write-only: null means "leave unchanged" (it is never sent back to the
 * client, so an empty field cannot mean "clear"). Every other field is the full
 * desired value.
 */
final readonly class EmployeeData
{
    /**
     * @param  list<Role>  $roles
     */
    public function __construct(
        public string $name,
        public string $email,
        public ?string $divisionId,
        public ?string $teamId,
        public ?string $positionId,
        public ?string $managerId,
        public WorkMode $workMode,
        public ?CarbonImmutable $joinedAt,
        public array $roles,
        public ?string $employeeNumber = null,
        public ?string $phone = null,
        public ?string $nik = null,
    ) {}

    /**
     * @param  array<string, mixed>  $input  validated request data
     */
    public static function fromValidated(array $input): self
    {
        $roles = is_array($input['roles'] ?? null) ? $input['roles'] : [];

        return new self(
            name: trim(self::string($input['name'] ?? null) ?? ''),
            email: mb_strtolower(trim(self::string($input['email'] ?? null) ?? '')),
            divisionId: self::string($input['division_id'] ?? null),
            teamId: self::string($input['team_id'] ?? null),
            positionId: self::string($input['position_id'] ?? null),
            managerId: self::string($input['manager_id'] ?? null),
            workMode: WorkMode::from(self::string($input['work_mode'] ?? null) ?? WorkMode::Office->value),
            joinedAt: ($date = self::string($input['joined_at'] ?? null)) === null ? null : CarbonImmutable::parse($date),
            roles: array_values(array_unique(array_map(
                fn (mixed $role): Role => $role instanceof Role ? $role : Role::from(is_string($role) ? $role : ''),
                $roles,
            ), SORT_REGULAR)),
            employeeNumber: self::string($input['employee_number'] ?? null),
            phone: self::string($input['phone'] ?? null),
            nik: self::string($input['nik'] ?? null),
        );
    }

    public function withManager(?string $managerId): self
    {
        return new self(
            $this->name, $this->email, $this->divisionId, $this->teamId, $this->positionId, $managerId,
            $this->workMode, $this->joinedAt, $this->roles, $this->employeeNumber, $this->phone, $this->nik,
        );
    }

    /**
     * @return list<string>
     */
    public function roleNames(): array
    {
        return array_map(fn (Role $role): string => $role->value, $this->roles);
    }

    private static function string(mixed $value): ?string
    {
        if (! is_string($value) && ! is_int($value)) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
