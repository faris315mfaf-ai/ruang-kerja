<?php

namespace Database\Factories;

use App\Models\ManagementNote;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ManagementNote>
 */
class ManagementNoteFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'user_id' => fn (array $attributes): string => User::factory()->create(['company_id' => $attributes['company_id']])->id,
            'body' => fake()->sentence(),
            'due_on' => null,
            'done_at' => null,
            'position' => 'V'.strtoupper(fake()->unique()->lexify('????')),
        ];
    }

    public function ownedBy(User $user): static
    {
        return $this->state(fn (): array => ['company_id' => $user->company_id, 'user_id' => $user->id]);
    }

    public function done(): static
    {
        return $this->state(fn (): array => ['done_at' => now()]);
    }
}
