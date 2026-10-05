<?php

namespace App\Domain\Analytics\Data;

use App\Domain\Analytics\Enums\DashboardView;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Everything a dashboard request resolved before computing: the view, the
 * normalized filter, the selectable divisions/teams and the measured people.
 */
final readonly class DashboardContext
{
    /**
     * @param  Collection<int, Division>  $divisions
     * @param  Collection<int, Team>  $teams
     * @param  Collection<int, User>  $people  active, visible to the viewer, with `division:id,name`
     */
    public function __construct(
        public User $viewer,
        public DashboardView $view,
        public DashboardFilters $filters,
        public Collection $divisions,
        public Collection $teams,
        public Collection $people,
    ) {}

    /**
     * @return list<string>
     */
    public function userIds(): array
    {
        return array_values(array_map('strval', $this->people->modelKeys()));
    }

    /** "Divisi Operasional", "Semua divisi", "Divisi Operasional · Tim Gudang". */
    public function scopeLabel(): string
    {
        $division = $this->filters->division ?? ($this->divisions->count() === 1 ? $this->divisions->first() : null);
        $label = $division !== null ? $division->name : 'Semua divisi';

        return $this->filters->team !== null ? $label.' · '.$this->filters->team->name : $label;
    }

    /**
     * Filter options for the UI.
     *
     * @return array{divisions: array<int, array{id: string, name: string}>, teams: array<int, array{id: string, name: string, division_id: string}>}
     */
    public function options(): array
    {
        return [
            'divisions' => $this->divisions->map(fn (Division $division): array => ['id' => $division->id, 'name' => $division->name])->values()->all(),
            'teams' => $this->teams->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name, 'division_id' => $team->division_id])->values()->all(),
        ];
    }
}
