<?php

namespace App\Http\Resources\Attendance;

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Attendance\Support\Weekdays;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Props of Admin › Lokasi, shift & hari libur (mockup LokasiShift).
 */
final class AttendanceSettingsData
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function locations(User $viewer): array
    {
        $counts = $this->activePatterns($viewer)
            ->filter(fn (ShiftAssignment $assignment): bool => $assignment->shift?->office_location_id !== null)
            ->groupBy(fn (ShiftAssignment $assignment): string => (string) $assignment->shift?->office_location_id)
            ->map(fn (Collection $group): int => $group->pluck('user_id')->unique()->count());

        return OfficeLocation::query()
            ->visibleTo($viewer)
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get()
            ->map(fn (OfficeLocation $location): array => [
                'id' => $location->id,
                'name' => $location->name,
                'address' => $location->address,
                'latitude' => $location->latitude,
                'longitude' => $location->longitude,
                'radiusM' => $location->radius_m,
                'isActive' => $location->is_active,
                'employeesCount' => $counts->get($location->id, 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function shifts(User $viewer): array
    {
        $patterns = $this->activePatterns($viewer)->groupBy('shift_id');

        return Shift::query()
            ->visibleTo($viewer)
            ->with('officeLocation')
            ->orderBy('start_time')
            ->orderBy('name')
            ->get()
            ->map(function (Shift $shift) use ($patterns): array {
                /** @var Collection<int, ShiftAssignment> $assigned */
                $assigned = $patterns->get($shift->id, collect());
                $weekdays = array_values($assigned->flatMap(fn (ShiftAssignment $assignment): array => $assignment->weekdays)->unique()->all());

                return [
                    'id' => $shift->id,
                    'name' => $shift->name,
                    'startTime' => substr($shift->start_time, 0, 5),
                    'endTime' => substr($shift->end_time, 0, 5),
                    'hours' => $shift->hoursLabel(),
                    'breakMinutes' => $shift->break_minutes,
                    'crossesMidnight' => $shift->crosses_midnight,
                    'lateToleranceMin' => $shift->late_tolerance_min,
                    'earlyLeaveToleranceMin' => $shift->early_leave_tolerance_min,
                    'checkInWindowBeforeMin' => $shift->check_in_window_before_min,
                    'officeLocationId' => $shift->office_location_id,
                    'locationName' => $shift->officeLocation?->name,
                    'daysLabel' => $weekdays === [] ? null : Weekdays::label($weekdays),
                    'employeesCount' => $assigned->pluck('user_id')->unique()->count(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Upcoming holidays, or one calendar year.
     *
     * @return array<int, array<string, mixed>>
     */
    public function holidays(User $viewer, ?int $year): array
    {
        $query = Holiday::query()->visibleTo($viewer)->orderBy('date');

        if ($year !== null) {
            $query->whereYear('date', $year);
        } else {
            $query->whereDate('date', '>=', $this->today()->toDateString())->limit(100);
        }

        return $query->get()
            ->map(fn (Holiday $holiday): array => [
                'id' => $holiday->id,
                'date' => $holiday->date->toDateString(),
                'name' => $holiday->name,
                'type' => $holiday->type->value,
                'typeLabel' => $holiday->type->label(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    public function holidayYears(User $viewer): array
    {
        $current = $this->today()->year;

        /** @var list<int> $years */
        $years = Holiday::query()
            ->visibleTo($viewer)
            ->selectRaw('DISTINCT EXTRACT(YEAR FROM date)::int AS year')
            ->pluck('year')
            ->map(fn (mixed $year): int => is_numeric($year) ? (int) $year : $current)
            ->push($current, $current + 1)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $years;
    }

    /**
     * Weekly patterns active today for active employees of the viewer's company.
     *
     * @return Collection<int, ShiftAssignment>
     */
    private function activePatterns(User $viewer): Collection
    {
        return ShiftAssignment::query()
            ->with('shift')
            ->patternsActiveOn($this->today())
            ->whereIn('user_id', User::query()->visibleTo($viewer)->active()->select('users.id'))
            ->get();
    }

    private function today(): CarbonImmutable
    {
        return ScheduleResolver::officeDate(CarbonImmutable::now());
    }
}
