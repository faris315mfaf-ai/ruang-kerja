<?php

namespace App\Domain\Organization\Data;

use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use Illuminate\Http\Request;

/**
 * Query-string state of the employee list. Unknown values fall back to defaults
 * (a bookmarked or hand-edited URL never errors).
 */
final readonly class EmployeeFilters
{
    public const array SORTS = ['name', 'division', 'position', 'manager', 'work_mode', 'joined_at', 'status'];

    public const array PER_PAGE = [10, 25, 50];

    /**
     * @param  'asc'|'desc'  $direction
     */
    public function __construct(
        public ?string $search = null,
        public ?string $division = null,
        public ?Role $role = null,
        public ?UserStatus $status = null,
        public string $sort = 'name',
        public string $direction = 'asc',
        public int $perPage = 10,
    ) {}

    public static function fromRequest(Request $request): self
    {
        $search = trim($request->string('search')->limit(100, '')->toString());
        $division = $request->string('division')->toString();
        $sort = $request->string('sort')->toString();
        $perPage = $request->integer('per_page', 10);

        return new self(
            search: $search === '' ? null : $search,
            division: $division === '' ? null : $division,
            role: Role::tryFrom($request->string('role')->toString()),
            status: UserStatus::tryFrom($request->string('status')->toString()),
            sort: in_array($sort, self::SORTS, true) ? $sort : 'name',
            direction: $request->string('direction')->toString() === 'desc' ? 'desc' : 'asc',
            perPage: in_array($perPage, self::PER_PAGE, true) ? $perPage : 10,
        );
    }

    /**
     * @return array{search: string|null, division: string|null, role: string|null, status: string|null, sort: string, direction: 'asc'|'desc', per_page: int}
     */
    public function toArray(): array
    {
        return [
            'search' => $this->search,
            'division' => $this->division,
            'role' => $this->role?->value,
            'status' => $this->status?->value,
            'sort' => $this->sort,
            'direction' => $this->direction,
            'per_page' => $this->perPage,
        ];
    }
}
