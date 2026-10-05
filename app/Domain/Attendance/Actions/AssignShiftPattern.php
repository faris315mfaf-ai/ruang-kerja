<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Assigns a weekly pattern to one or many employees (e.g. a whole division).
 *
 * An open-ended pattern supersedes older patterns whose weekdays it fully
 * covers: they end the day before (or disappear when they start later).
 * Bounded patterns simply take precedence during their period (the resolver
 * prefers the latest valid_from), so the regular pattern resumes afterwards.
 */
final class AssignShiftPattern
{
    /**
     * @param  iterable<User>  $employees
     * @param  list<int>  $weekdays
     * @return int number of employees assigned
     */
    public function handle(
        iterable $employees,
        Shift $shift,
        array $weekdays,
        CarbonImmutable $validFrom,
        ?CarbonImmutable $validUntil = null,
        ?WorkMode $workModeOverride = null,
    ): int {
        $weekdays = array_values(array_unique(array_map(intval(...), $weekdays)));
        sort($weekdays);
        $from = $validFrom->toDateString();
        $count = 0;

        DB::transaction(function () use ($employees, $shift, $weekdays, $validFrom, $validUntil, $workModeOverride, $from, &$count): void {
            foreach ($employees as $employee) {
                if ($validUntil === null) {
                    $this->supersede($employee, $weekdays, $validFrom);
                }

                ShiftAssignment::query()->create([
                    'user_id' => $employee->id,
                    'shift_id' => $shift->id,
                    'weekdays' => $weekdays,
                    'valid_from' => $from,
                    'valid_until' => $validUntil?->toDateString(),
                    'work_mode_override' => $workModeOverride,
                ]);

                $count++;
            }
        });

        return $count;
    }

    /**
     * @param  list<int>  $weekdays
     */
    private function supersede(User $employee, array $weekdays, CarbonImmutable $validFrom): void
    {
        $from = $validFrom->toDateString();

        $patterns = ShiftAssignment::query()
            ->where('user_id', $employee->id)
            ->whereNull('override_date')
            ->where(fn ($query) => $query->whereNull('valid_until')->orWhereDate('valid_until', '>=', $from))
            ->get();

        foreach ($patterns as $pattern) {
            if (array_diff($pattern->weekdays, $weekdays) !== []) {
                continue;
            }

            if ($pattern->valid_from->toDateString() >= $from) {
                $pattern->delete();

                continue;
            }

            $pattern->valid_until = $validFrom->subDay();
            $pattern->save();
        }
    }
}
