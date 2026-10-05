<?php

namespace App\Domain\Organization\Services;

use App\Domain\Organization\Data\OrgChart;
use App\Domain\Organization\Data\OrgDivision;
use App\Domain\Organization\Data\OrgPerson;
use App\Domain\Organization\Data\OrgTeam;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;

/**
 * Builds the org chart (Direksi → Divisi → Tim → anggota) for the viewer's company
 * with three queries, independent of the chart's size.
 *
 * Visibility: divisions and teams through their visibleTo() scopes (whole company,
 * DivisionPolicy::viewAny). People are shown as a company directory — active
 * employees with name, position and avatar only — so every employee can read the
 * chart; private data (email, phone, status, profile) is never included.
 *
 * Placement: each active employee appears once — in their team, else loose in
 * their division, else in `unassigned` (unless they head a division or lead a
 * team, where they already appear). Division heads and team leads are shown on
 * the unit card instead of in its member list.
 */
final class OrganizationTree
{
    /** @var array<string, OrgPerson> */
    private array $people = [];

    /** @var array<string, list<Division>> */
    private array $childrenOf = [];

    /** @var array<string, list<Team>> */
    private array $teamsOf = [];

    /** @var array<string, list<OrgPerson>> */
    private array $teamMembers = [];

    /** @var array<string, list<OrgPerson>> */
    private array $looseMembers = [];

    /** @var array<string, int> */
    private array $divisionSize = [];

    /** @var array<string, int> */
    private array $teamSize = [];

    public function for(User $viewer): OrgChart
    {
        $this->people = $this->childrenOf = $this->teamsOf = [];
        $this->teamMembers = $this->looseMembers = $this->divisionSize = $this->teamSize = [];

        $divisions = Division::query()->visibleTo($viewer)
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name', 'code', 'head_user_id', 'is_board']);

        $teams = Team::query()->visibleTo($viewer)
            ->orderBy('name')
            ->get(['id', 'division_id', 'name', 'code', 'lead_user_id']);

        $users = User::query()
            ->where('company_id', $viewer->company_id)
            ->active()
            ->with(['position:id,name,level', 'roles:id,name'])
            ->get(['id', 'name', 'avatar_url', 'division_id', 'team_id', 'position_id', 'manager_id'])
            ->sortBy([
                fn (User $a, User $b): int => ($a->position->level ?? PHP_INT_MAX) <=> ($b->position->level ?? PHP_INT_MAX),
                fn (User $a, User $b): int => strcasecmp($a->name, $b->name),
            ])
            ->values();

        foreach ($users as $user) {
            $this->people[$user->id] = $this->person($user);
        }

        foreach ($teams as $team) {
            $this->teamsOf[$team->division_id][] = $team;
        }

        $divisionIds = $divisions->pluck('id')->flip();
        $teamIds = $teams->pluck('id')->flip();
        $heads = $divisions->pluck('head_user_id')->filter()->flip();
        $leads = $teams->keyBy('id')->map(fn (Team $team): ?string => $team->lead_user_id);
        $headOf = $divisions->keyBy('id')->map(fn (Division $division): ?string => $division->head_user_id);
        $unassigned = [];

        foreach ($users as $user) {
            $person = $this->people[$user->id];

            if ($user->division_id !== null && $divisionIds->has($user->division_id)) {
                $this->divisionSize[$user->division_id] = ($this->divisionSize[$user->division_id] ?? 0) + 1;
            }

            if ($user->team_id !== null && $teamIds->has($user->team_id)) {
                $this->teamSize[$user->team_id] = ($this->teamSize[$user->team_id] ?? 0) + 1;

                if ($leads[$user->team_id] !== $user->id) {
                    $this->teamMembers[$user->team_id][] = $person;
                }
            } elseif ($user->division_id !== null && $divisionIds->has($user->division_id)) {
                if ($headOf[$user->division_id] !== $user->id) {
                    $this->looseMembers[$user->division_id][] = $person;
                }
            } elseif (! $heads->has($user->id) && ! $leads->contains($user->id)) {
                $unassigned[] = $person;
            }
        }

        $board = $divisions->first(fn (Division $division): bool => $division->is_board && $division->parent_id === null);
        $rootParent = fn (Division $division): bool => $division->parent_id === null
            || ! $divisionIds->has($division->parent_id)
            || $division->parent_id === $board?->id;

        $nonBoard = $divisions->reject(fn (Division $division): bool => $division->id === $board?->id);
        foreach ($nonBoard->reject($rootParent) as $child) {
            $this->childrenOf[(string) $child->parent_id][] = $child;
        }

        $visited = [];

        return new OrgChart(
            companyName: $viewer->company->name,
            board: $board === null ? null : $this->division($board, $visited, withChildren: false),
            divisions: array_values($nonBoard->filter($rootParent)
                ->map(fn (Division $division): OrgDivision => $this->division($division, $visited))
                ->all()),
            unassigned: $unassigned,
            stats: [
                'divisions' => $nonBoard->count(),
                'teams' => $teams->count(),
                'people' => $users->count(),
            ],
        );
    }

    /**
     * @param  array<string, true>  $visited  guards against corrupted parent cycles
     */
    private function division(Division $division, array &$visited, bool $withChildren = true): OrgDivision
    {
        $visited[$division->id] = true;
        $children = [];

        if ($withChildren) {
            foreach ($this->childrenOf[$division->id] ?? [] as $child) {
                if (! isset($visited[$child->id])) {
                    $children[] = $this->division($child, $visited);
                }
            }
        }

        return new OrgDivision(
            id: $division->id,
            name: $division->name,
            code: $division->code,
            isBoard: $division->is_board,
            head: $division->head_user_id === null ? null : ($this->people[$division->head_user_id] ?? null),
            teams: array_map(fn (Team $team): OrgTeam => new OrgTeam(
                id: $team->id,
                name: $team->name,
                code: $team->code,
                lead: $team->lead_user_id === null ? null : ($this->people[$team->lead_user_id] ?? null),
                members: $this->teamMembers[$team->id] ?? [],
                size: $this->teamSize[$team->id] ?? 0,
            ), $this->teamsOf[$division->id] ?? []),
            members: $this->looseMembers[$division->id] ?? [],
            size: $this->divisionSize[$division->id] ?? 0,
            children: $children,
        );
    }

    private function person(User $user): OrgPerson
    {
        /** @var list<string> $roles */
        $roles = $user->roles->pluck('name')->values()->all();

        return new OrgPerson(
            id: $user->id,
            name: $user->name,
            avatar: $user->avatar_url,
            position: $user->position?->name,
            level: $user->position?->level,
            managerId: $user->manager_id,
            roles: $roles,
        );
    }
}
