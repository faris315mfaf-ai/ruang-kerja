<?php

namespace Database\Factories;

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AttendanceDay>
 */
class AttendanceDayFactory extends Factory
{
    protected $model = AttendanceDay::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'work_date' => now(config()->string('app.office_timezone'))->toDateString(),
            'status' => AttendanceStatus::Present,
        ];
    }

    public function on(string $date): static
    {
        return $this->state(fn (): array => ['work_date' => $date]);
    }

    public function status(AttendanceStatus $status): static
    {
        return $this->state(fn (): array => ['status' => $status]);
    }
}
