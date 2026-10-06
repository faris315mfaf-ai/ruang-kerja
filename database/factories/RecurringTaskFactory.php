<?php

namespace Database\Factories;

use App\Domain\Tasks\Enums\TaskPriority;
use App\Models\RecurringTask;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Default: every Monday from 5 Oct 2026, no end.
 *
 * @extends Factory<RecurringTask>
 */
class RecurringTaskFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (array $attributes): string => Workspace::query()->findOrFail($attributes['workspace_id'])->company_id,
            'workspace_id' => Workspace::factory(),
            'title' => 'Rekap '.fake()->unique()->word(),
            'priority' => TaskPriority::Medium,
            'pattern' => ['kind' => 'weekly', 'weekdays' => [1]],
            'starts_on' => '2026-10-05',
            'ends_on' => null,
            'is_active' => true,
        ];
    }

    public function forWorkspace(Workspace $workspace): static
    {
        return $this->state(fn (): array => [
            'workspace_id' => $workspace->id,
            'company_id' => $workspace->company_id,
            'created_by' => $workspace->owner_id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $pattern
     */
    public function pattern(array $pattern): static
    {
        return $this->state(fn (): array => ['pattern' => $pattern]);
    }
}
