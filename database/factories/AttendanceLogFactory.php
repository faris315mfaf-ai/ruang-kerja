<?php

namespace Database\Factories;

use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AttendanceLog>
 */
class AttendanceLogFactory extends Factory
{
    protected $model = AttendanceLog::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'attendance_day_id' => AttendanceDay::factory(),
            'user_id' => fn (array $attributes): mixed => AttendanceDay::query()->whereKey($attributes['attendance_day_id'])->value('user_id'),
            'type' => AttendanceLogType::CheckIn,
            'method' => AttendanceMethod::GpsSelfie,
            'occurred_at' => now(),
            'client_time' => now(),
            'latitude' => -6.2,
            'longitude' => 106.816666,
            'accuracy_m' => 12,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Pest',
            'device_fingerprint' => 'test-device',
            'flags' => [],
            'is_suspicious' => false,
        ];
    }

    public function forDay(AttendanceDay $day): static
    {
        return $this->state(fn (): array => ['attendance_day_id' => $day->id, 'user_id' => $day->user_id]);
    }

    public function checkOut(): static
    {
        return $this->state(fn (): array => ['type' => AttendanceLogType::CheckOut]);
    }
}
