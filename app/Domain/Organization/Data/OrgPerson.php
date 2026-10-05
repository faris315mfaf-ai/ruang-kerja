<?php

namespace App\Domain\Organization\Data;

/**
 * A person on the org chart. Directory fields only (no email, phone or status).
 */
final readonly class OrgPerson
{
    /**
     * @param  list<string>  $roles  global role names, e.g. ['kepala_divisi', 'hr']
     */
    public function __construct(
        public string $id,
        public string $name,
        public ?string $avatar,
        public ?string $position,
        public ?int $level,
        public ?string $managerId,
        public array $roles,
    ) {}
}
