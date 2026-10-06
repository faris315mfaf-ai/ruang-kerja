<?php

namespace App\Domain\Okr\Queries;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Services\OkrPeople;
use App\Domain\Okr\Services\OkrPresenter;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\Division;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Props of /okr (OkrIndexProps in features/okr/types.ts): the visible
 * objectives of one quarter (and optionally one division), the quarter and
 * division filters, and what the "Objective baru" form needs.
 */
final class OkrIndex
{
    /** Quarter tabs shown at most (newest first). */
    private const int MAX_QUARTERS = 4;

    public function __construct(
        private readonly OkrPresenter $presenter,
        private readonly OkrPeople $people,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(User $viewer, ?Quarter $quarter, ?string $divisionId): array
    {
        $today = OfficeTime::today();
        $current = Quarter::of($today);
        $selected = $quarter ?? $current;
        $divisions = $this->divisions($viewer);
        $divisionIds = array_map(fn (array $division): string => $division['id'], $divisions);
        $division = $divisionId !== null && in_array($divisionId, $divisionIds, true) ? $divisionId : null;

        $objectives = Objective::query()
            ->visibleTo($viewer)
            ->where('quarter', $selected->key())
            ->when($division !== null, fn ($query) => $query->where('division_id', $division))
            ->with(['division', 'owner:id,name', 'keyResults.owner:id,name'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $usedQuarters = Objective::query()->visibleTo($viewer)->distinct()->orderByDesc('quarter')->limit(self::MAX_QUARTERS)->pluck('quarter')->all();
        $quarters = array_values(array_unique([...$usedQuarters, $current->key(), $selected->key()]));
        rsort($quarters);

        $canCreate = Gate::forUser($viewer)->allows('createAny', Objective::class);

        return [
            'today' => $today->toDateString(),
            'quarters' => array_slice($quarters, 0, max(self::MAX_QUARTERS, (int) array_search($selected->key(), $quarters, true) + 1)),
            'current_quarter' => $current->key(),
            'filters' => ['quarter' => $selected->key(), 'division' => $division ?? 'all'],
            'divisions' => $divisions,
            'objectives' => $objectives->map(fn (Objective $objective): array => $this->presenter->summary($objective))->values()->all(),
            'create' => $canCreate ? $this->createOptions($viewer, $current) : null,
        ];
    }

    /**
     * Divisions in the filter: every division for company-wide readers,
     * otherwise the viewer's own and led divisions plus those of the
     * objectives they own a key result in.
     *
     * @return list<array{id: string, name: string, code: string}>
     */
    private function divisions(User $viewer): array
    {
        $query = Division::query()->where('company_id', $viewer->company_id)->orderBy('name');

        if (! $viewer->hasPermission(Permission::DashboardViewCompany)) {
            $query->where(fn ($scope) => $scope
                ->whereIn('id', Objective::divisionScopeFor($viewer))
                ->orWhereIn('id', Objective::query()->visibleTo($viewer)->select('division_id')));
        }

        return array_values($query->get(['id', 'name', 'code'])
            ->map(fn (Division $division): array => $this->presenter->division($division))
            ->all());
    }

    /**
     * Divisions the viewer may create objectives in, their eligible owners and
     * the quarters offered (previous, current, next).
     *
     * @return array{divisions: list<array{id: string, name: string, code: string}>, people: list<array{id: string, name: string, division_id: string|null}>, quarters: list<string>}
     */
    private function createOptions(User $viewer, Quarter $current): array
    {
        $divisions = Division::query()
            ->where('company_id', $viewer->company_id)
            ->when(! $viewer->hasRole(Role::Direksi), fn ($query) => $query->whereIn('id', $viewer->ledDivisionIds()))
            ->orderBy('name')
            ->get(['id', 'company_id', 'name', 'code', 'head_user_id']);

        $divisionIds = array_values($divisions->map(fn (Division $division): string => $division->id)->all());
        /** @var array<string, string> $headOf head user id => division id */
        $headOf = [];

        foreach ($divisions as $division) {
            if ($division->head_user_id !== null) {
                $headOf[$division->head_user_id] ??= $division->id;
            }
        }

        $people = $divisionIds === [] ? collect() : $this->people
            ->query($viewer->company_id, $divisionIds)
            ->orderBy('name')
            ->get(['id', 'name', 'division_id']);

        return [
            'divisions' => array_values($divisions->map(fn (Division $division): array => $this->presenter->division($division))->all()),
            // A head outside the division (head_user_id) is offered for the division they head.
            'people' => array_values($people->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'division_id' => in_array($user->division_id, $divisionIds, true) ? $user->division_id : ($headOf[$user->id] ?? null),
            ])->all()),
            'quarters' => [$current->next()->key(), $current->key(), $current->previous()->key()],
        ];
    }
}
