<?php

namespace App\Domain\Organization\Data;

final readonly class OrgTeam
{
    /**
     * @param  list<OrgPerson>  $members  everyone in the team except the lead
     * @param  int  $size  active employees in the team (lead included when a member)
     */
    public function __construct(
        public string $id,
        public string $name,
        public ?string $code,
        public ?OrgPerson $lead,
        public array $members,
        public int $size,
    ) {}
}
