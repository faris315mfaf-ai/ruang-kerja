<?php

namespace Database\Factories;

use App\Models\Label;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Label>
 */
class LabelFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => ucfirst(fake()->unique()->word()),
            'color' => fake()->randomElement(['teal', 'blue', 'green', 'amber', 'violet', 'red']),
        ];
    }
}
