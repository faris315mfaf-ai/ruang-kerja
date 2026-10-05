<?php

namespace App\Domain\Organization\Data;

final readonly class OrgDivision
{
    /**
     * @param  list<OrgTeam>  $teams
     * @param  list<OrgPerson>  $members  division members without a team, head excluded
     * @param  int  $size  active employees whose division is this one (head included when a member)
     * @param  list<OrgDivision>  $children  sub-divisions
     */
    public function __construct(
        public string $id,
        public string $name,
        public string $code,
        public bool $isBoard,
        public ?OrgPerson $head,
        public array $teams,
        public array $members,
        public int $size,
        public array $children,
    ) {}
}
