<?php

namespace Database\Factories;

use App\Models\Position;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Position>
 */
class PositionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'name' => 'Staf '.fake()->unique()->word(),
            'level' => Position::LEVEL_STAFF,
        ];
    }

    public function level(int $level): static
    {
        return $this->state(fn (): array => ['level' => $level]);
    }
}
