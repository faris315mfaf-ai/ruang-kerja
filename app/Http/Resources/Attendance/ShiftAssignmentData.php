<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\Weekdays;
use App\Models\Division;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

/**
 * Props of Admin › Penugasan shift: employees with their current/future
 * weekly patterns and upcoming date overrides.
 */
final class ShiftAssignmentData
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function employees(User $viewer): array
    {
        $today = ScheduleResolver::officeDate(CarbonImmutable::now())->toDateString();

        /** @var Collection<int, ShiftAssignment> $assignments */
        $assignments = ShiftAssignment::query()
            ->with('shift')
            ->visibleTo($viewer)
            ->where(fn ($query) => $query->whereNull('valid_until')->orWhereDate('valid_until', '>=', $today))
            ->orderBy('valid_from')
            ->get();

        $byUser = $assignments->groupBy('user_id');

        return User::query()
            ->visibleTo($viewer)
            ->active()
            ->with('division:id,name,code')
            ->orderBy('name')
            ->get()
            ->map(function (User $user) use ($byUser): array {
                /** @var Collection<int, ShiftAssignment> $own */
                $own = $byUser->get($user->id, new Collection);

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'divisionId' => $user->division_id,
                    'divisionName' => $user->division?->name,
                    'divisionCode' => $user->division?->code,
                    'workMode' => $user->work_mode->value,
                    'workModeLabel' => $user->work_mode->label(),
                    'patterns' => $own->filter(fn (ShiftAssignment $a): bool => ! $a->isOverride())
                        ->map(fn (ShiftAssignment $a): array => $this->pattern($a))->values()->all(),
                    'overrides' => $own->filter(fn (ShiftAssignment $a): bool => $a->isOverride())
                        ->sortBy(fn (ShiftAssignment $a): string => (string) $a->override_date?->toDateString())
                        ->map(fn (ShiftAssignment $a): array => $this->override($a))->values()->all(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{id: string, name: string, code: string}>
     */
    public function divisions(User $viewer): array
    {
        return Division::query()
            ->visibleTo($viewer)
            ->orderBy('name')
            ->get(['id', 'name', 'code'])
            ->map(fn (Division $division): array => ['id' => $division->id, 'name' => $division->name, 'code' => $division->code])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{id: string, name: string, hours: string}>
     */
    public function shifts(User $viewer): array
    {
        return Shift::query()
            ->visibleTo($viewer)
            ->orderBy('start_time')
            ->get()
            ->map(fn (Shift $shift): array => ['id' => $shift->id, 'name' => $shift->name, 'hours' => $shift->hoursLabel()])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function pattern(ShiftAssignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'shiftName' => $assignment->shift?->name,
            'hours' => $assignment->shift?->hoursLabel(),
            'weekdays' => $assignment->weekdays,
            'daysLabel' => Weekdays::label($assignment->weekdays),
            'validFrom' => $assignment->valid_from->toDateString(),
            'validUntil' => $assignment->valid_until?->toDateString(),
            'workMode' => $assignment->work_mode_override?->value,
            'workModeLabel' => $assignment->work_mode_override?->label(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function override(ShiftAssignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'date' => $assignment->override_date?->toDateString(),
            'shiftName' => $assignment->shift?->name,
            'hours' => $assignment->shift?->hoursLabel(),
            'workMode' => $assignment->work_mode_override?->value,
            'workModeLabel' => $assignment->work_mode_override?->label(),
        ];
    }
}
