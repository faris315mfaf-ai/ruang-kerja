<?php

namespace Database\Factories;

use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Raw rows for tests that do not need the full submit flow. Use the
 * SubmitRequest action when steps, balances and numbers matter.
 *
 * @extends Factory<EmployeeRequest>
 */
class EmployeeRequestFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = now()->addWeek()->startOfDay();

        return [
            'number' => null,
            'user_id' => User::factory(),
            'leave_type_id' => LeaveType::factory(),
            'start_at' => $start,
            'end_at' => $start->endOfDay(),
            'days' => 1,
            'minutes' => null,
            'reason' => fake()->sentence(),
            'payload' => [],
            'status' => RequestStatus::Draft,
            'round' => 1,
        ];
    }

    public function status(RequestStatus $status): static
    {
        return $this->state(fn (): array => [
            'status' => $status,
            'number' => $status === RequestStatus::Draft ? null : 'TST-'.fake()->unique()->numerify('######'),
            'submitted_at' => $status === RequestStatus::Draft ? null : now(),
        ]);
    }
}
