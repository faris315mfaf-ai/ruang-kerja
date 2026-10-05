<?php

namespace Database\Factories;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Models\TaskStatus;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TaskStatus>
 */
class TaskStatusFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => 'Kolom '.fake()->unique()->word(),
            'category' => TaskStatusCategory::Todo,
            'color' => 'slate',
            'position' => 'z'.strtoupper(fake()->unique()->lexify('???')),
        ];
    }

    public function category(TaskStatusCategory $category): static
    {
        return $this->state(fn (): array => [
            'category' => $category,
            'name' => $category->label(),
            'color' => $category->defaultColor(),
        ]);
    }
}
