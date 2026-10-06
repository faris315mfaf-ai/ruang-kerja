<?php

namespace Database\Factories;

use App\Domain\Okr\Enums\KeyResultUnit;
use App\Models\KeyResult;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<KeyResult>
 */
class KeyResultFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'objective_id' => Objective::factory(),
            'title' => fake()->sentence(4),
            'unit' => KeyResultUnit::Number,
            'unit_label' => '',
            'start_value' => 0,
            'target_value' => 100,
            'current_value' => 0,
            'weight' => 1,
            'owner_id' => fn (array $attributes): string => Objective::query()->whereKey($attributes['objective_id'])->firstOrFail()->owner_id,
            'position' => 0,
        ];
    }

    public function ownedBy(User $owner): static
    {
        return $this->state(fn (): array => ['owner_id' => $owner->id]);
    }

    public function values(float $start, float $target, float $current, float $weight = 1): static
    {
        return $this->state(fn (): array => [
            'start_value' => $start,
            'target_value' => $target,
            'current_value' => $current,
            'weight' => $weight,
        ]);
    }
}
