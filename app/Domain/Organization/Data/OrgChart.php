<?php

namespace App\Domain\Organization\Data;

final readonly class OrgChart
{
    /**
     * @param  list<OrgDivision>  $divisions  top-level divisions under the board
     * @param  list<OrgPerson>  $unassigned  active employees outside any division who lead nothing
     * @param  array{divisions: int, teams: int, people: int}  $stats
     */
    public function __construct(
        public string $companyName,
        public ?OrgDivision $board,
        public array $divisions,
        public array $unassigned,
        public array $stats,
    ) {}
}
