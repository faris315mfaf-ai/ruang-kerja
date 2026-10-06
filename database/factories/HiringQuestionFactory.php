<?php

namespace Database\Factories;

use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<HiringQuestion>
 */
class HiringQuestionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'position_id' => HiringPosition::factory(),
            'prompt' => fake()->sentence().'?',
            'guidance' => null,
            'max_score' => 5,
            'position' => fake()->numberBetween(1, 100),
        ];
    }
}
