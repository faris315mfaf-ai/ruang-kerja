<?php

namespace Database\Factories;

use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShiftAssignment>
 */
class ShiftAssignmentFactory extends Factory
{
    protected $model = ShiftAssignment::class;

    /**
     * Monday–Friday pattern starting a year ago.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'shift_id' => Shift::factory(),
            'weekdays' => [1, 2, 3, 4, 5],
            'valid_from' => now()->subYear()->toDateString(),
            'valid_until' => null,
            'override_date' => null,
            'work_mode_override' => null,
        ];
    }

    /**
     * @param  list<int>  $weekdays
     */
    public function weekdays(array $weekdays): static
    {
        return $this->state(fn (): array => ['weekdays' => $weekdays]);
    }

    public function between(string $from, ?string $until = null): static
    {
        return $this->state(fn (): array => ['valid_from' => $from, 'valid_until' => $until]);
    }

    /**
     * A single-date override; pass null shift for a day off.
     */
    public function override(string $date, ?Shift $shift = null): static
    {
        return $this->state(fn (): array => [
            'override_date' => $date,
            'valid_from' => $date,
            'valid_until' => $date,
            'weekdays' => [],
            'shift_id' => $shift?->id,
        ]);
    }

    public function workMode(WorkMode $mode): static
    {
        return $this->state(fn (): array => ['work_mode_override' => $mode]);
    }
}
