<?php

namespace Database\Factories;

use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Team>
 */
class TeamFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'division_id' => Division::factory(),
            'name' => 'Tim '.fake()->unique()->word(),
            'code' => null,
            'lead_user_id' => null,
        ];
    }

    public function ledBy(User $lead): static
    {
        return $this->state(fn (): array => ['lead_user_id' => $lead->id]);
    }
}
