<?php

namespace Database\Factories;

use App\Domain\Planner\Enums\PlanBucket;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TaskPlan>
 */
class TaskPlanFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'task_id' => Task::factory(),
            'bucket' => PlanBucket::Today,
            'planned_for' => now(config()->string('app.office_timezone'))->toDateString(),
            'position' => Lexorank::between(null, null),
            'seen_at' => now(),
        ];
    }

    public function in(PlanBucket $bucket, ?string $position = null): static
    {
        return $this->state(fn (): array => ['bucket' => $bucket, 'position' => $position ?? Lexorank::between(null, null)]);
    }

    /** Back to automatic placement; only seen_at is remembered. */
    public function auto(): static
    {
        return $this->state(fn (): array => ['bucket' => null, 'position' => null, 'planned_for' => null]);
    }
}
