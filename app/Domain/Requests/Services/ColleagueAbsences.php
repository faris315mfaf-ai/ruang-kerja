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
        $groupColumn = $user->team_id !== null ? 'team_id' : ($user->division_id !== null ? 'division_id' : null);

        if ($groupColumn === null) {
            return ['group' => null, 'size' => 0, 'people' => []];
        }

        $peers = User::query()->active()->where($groupColumn, $user->getAttribute($groupColumn));
        $size = (clone $peers)->count();

        $requests = EmployeeRequest::query()
            ->whereIn('user_id', (clone $peers)->whereKeyNot($user->id)->select('id'))
            ->whereIn('status', RequestStatus::values([RequestStatus::Pending, RequestStatus::Approved]))
            ->when($ignoreRequestId !== null, fn (Builder $query) => $query->whereKeyNot($ignoreRequestId))
            ->where('start_at', '<', $endAt)
            ->where('end_at', '>', $startAt)
            ->whereHas('leaveType', fn (Builder $type) => $type->whereIn(
                'category',
                [RequestCategory::Leave->value, RequestCategory::Sick->value, RequestCategory::BusinessTrip->value, RequestCategory::Permit->value],
            ))
            ->with('user:id,name')
            ->orderBy('start_at')
            ->limit(20)
            ->get();

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

        $group = $groupColumn === 'team_id' ? $user->team?->name : $user->division?->name;

        return ['group' => $group, 'size' => $size, 'people' => array_values($people)];
    }
}
