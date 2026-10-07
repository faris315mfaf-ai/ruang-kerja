<?php

namespace Database\Factories;

use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<KeyResultCheckin>
 */
class KeyResultCheckinFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'key_result_id' => KeyResult::factory(),
            'value' => 10,
            'confidence' => 7,
            'note' => null,
            'author_id' => fn (array $attributes): string => KeyResult::query()->whereKey($attributes['key_result_id'])->firstOrFail()->owner_id,
            'checked_on' => now()->toDateString(),
        ];
    }
}
