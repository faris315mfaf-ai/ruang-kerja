<?php

namespace Database\Factories;

use App\Domain\Tasks\Enums\SavedViewLayout;
use App\Models\SavedView;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SavedView>
 */
class SavedViewFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'workspace_id' => Workspace::factory(),
            'name' => ucfirst(fake()->word()).' '.fake()->word(),
            'layout' => SavedViewLayout::Board,
            'filters' => [],
            'is_shared' => false,
        ];
    }

    public function shared(): static
    {
        return $this->state(fn (): array => ['is_shared' => true]);
    }
}
