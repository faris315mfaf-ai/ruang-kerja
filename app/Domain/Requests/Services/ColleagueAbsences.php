<?php

namespace App\Domain\Requests\Services;

use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Support\OfficeTime;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Nadia Putri juga cuti pada 13 Okt": teammates (same team, otherwise same
 * division) absent in the same period, from pending or approved requests.
 */
final class ColleagueAbsences
{
    /**
     * @return array{group: string|null, size: int, people: list<array{id: string, name: string, dates: list<string>}>}
     */
    public function around(User $user, CarbonInterface $startAt, CarbonInterface $endAt, ?string $ignoreRequestId = null): array
    {
        $user->loadMissing(['team:id,name', 'division:id,name']);
        $groupColumn = self::groupColumn($user);

        if ($groupColumn === null) {
            return ['group' => null, 'size' => 0, 'people' => []];
        }

        $groupId = $user->getAttribute($groupColumn);
        $size = User::query()->active()->where($groupColumn, $groupId)->count();

        $requests = $this->absences(fn (Builder $users) => $users->where($groupColumn, $groupId)->whereKeyNot($user->id), $startAt, $endAt)
            ->when($ignoreRequestId !== null, fn (Builder $query) => $query->whereKeyNot($ignoreRequestId))
            ->limit(20)
            ->get();

        return ['group' => self::groupName($user, $groupColumn), 'size' => $size, 'people' => self::people($requests, $startAt, $endAt)];
    }

    /**
     * around() for many requests at once with a fixed number of queries (the
     * approval queue shows it on every card).
     *
     * @param  iterable<EmployeeRequest>  $requests  with user.team and user.division loaded
     * @return array<string, array{group: string|null, size: int, people: list<array{id: string, name: string, dates: list<string>}>}>
     */
    public function forRequests(iterable $requests): array
    {
        $items = [];
        $teamIds = [];
        $divisionIds = [];

        foreach ($requests as $request) {
            $column = self::groupColumn($request->user);

            if ($column === null) {
                continue;
            }

            $items[] = [$request, $column];
            $column === 'team_id' ? $teamIds[] = (string) $request->user->team_id : $divisionIds[] = (string) $request->user->division_id;
        }

        if ($items === []) {
            return [];
        }

        $sizes = [
            'team_id' => self::groupSizes('team_id', $teamIds),
            'division_id' => self::groupSizes('division_id', $divisionIds),
        ];

        $startAt = min(array_map(fn (array $item): CarbonInterface => $item[0]->start_at, $items));
        $endAt = max(array_map(fn (array $item): CarbonInterface => $item[0]->end_at, $items));

        $absences = $this->absences(fn (Builder $users) => $users->where(fn (Builder $group) => $group
            ->whereIn('team_id', array_values(array_unique($teamIds)))
            ->orWhereIn('division_id', array_values(array_unique($divisionIds)))), $startAt, $endAt)
            ->with('user:id,name,team_id,division_id')
            ->get();

        $result = [];

        foreach ($items as [$request, $column]) {
            $groupId = $request->user->getAttribute($column);
            $matching = $absences
                ->filter(fn (EmployeeRequest $other): bool => $other->id !== $request->id
                    && $other->user_id !== $request->user_id
                    && $other->user->getAttribute($column) === $groupId
                    && $other->start_at->lt($request->end_at)
                    && $other->end_at->gt($request->start_at))
                ->take(20);

            $result[$request->id] = [
                'group' => self::groupName($request->user, $column),
                'size' => $sizes[$column][(string) $groupId] ?? 0,
                'people' => self::people($matching, $request->start_at, $request->end_at),
            ];
        }

        return $result;
    }

    /**
     * Pending/approved absences of the selected (active) people overlapping the period.
     *
     * @param  \Closure(Builder<User>): mixed  $people
     * @return Builder<EmployeeRequest>
     */
    private function absences(\Closure $people, CarbonInterface $startAt, CarbonInterface $endAt): Builder
    {
        return EmployeeRequest::query()
            ->whereIn('user_id', User::query()->active()->select('id')->where($people))
            ->whereIn('status', RequestStatus::values([RequestStatus::Pending, RequestStatus::Approved]))
            ->where('start_at', '<', $endAt)
            ->where('end_at', '>', $startAt)
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn(
                'category',
                [RequestCategory::Leave->value, RequestCategory::Sick->value, RequestCategory::BusinessTrip->value, RequestCategory::Permit->value],
            ))
            ->with('user:id,name')
            ->orderBy('start_at')
            ->orderBy('id');
    }

    /**
     * @param  iterable<EmployeeRequest>  $requests
     * @return list<array{id: string, name: string, dates: list<string>}>
     */
    private static function people(iterable $requests, CarbonInterface $startAt, CarbonInterface $endAt): array
    {
        $people = [];

        foreach ($requests as $request) {
            $from = OfficeTime::local($request->start_at->max($startAt))->startOfDay();
            $to = OfficeTime::local($request->end_at->min($endAt))->startOfDay();
            $dates = [];

            for ($day = $from; $day->lte($to) && count($dates) < 31; $day = $day->addDay()) {
                if (! $day->isWeekend()) {
                    $dates[] = $day->toDateString();
                }
            }

            if ($dates === []) {
                continue;
            }

            $entry = $people[$request->user_id] ?? ['id' => $request->user_id, 'name' => $request->user->name, 'dates' => []];
            $entry['dates'] = array_values(array_unique([...$entry['dates'], ...$dates]));
            sort($entry['dates']);
            $people[$request->user_id] = $entry;
        }

        return array_values($people);
    }

    /**
     * Team when the person has one, otherwise division.
     *
     * @return 'team_id'|'division_id'|null
     */
    private static function groupColumn(User $user): ?string
    {
        return $user->team_id !== null ? 'team_id' : ($user->division_id !== null ? 'division_id' : null);
    }

    private static function groupName(User $user, string $column): ?string
    {
        return $column === 'team_id' ? $user->team?->name : $user->division?->name;
    }

    /**
     * Active people per group id.
     *
     * @param  'team_id'|'division_id'  $column
     * @param  list<string>  $ids
     * @return array<string, int>
     */
    private static function groupSizes(string $column, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        /** @var array<string, int> */
        return User::query()
            ->active()
            ->whereIn($column, array_values(array_unique($ids)))
            ->groupBy($column)
            ->selectRaw($column === 'team_id' ? 'team_id as group_id, count(*) as size' : 'division_id as group_id, count(*) as size')
            ->pluck('size', 'group_id')
            ->map(fn ($size): int => (int) $size)
            ->all();
    }
}
