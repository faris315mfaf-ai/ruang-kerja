<?php

namespace Database\Factories;

use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Models\Division;
use App\Models\Objective;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Objective>
 */
class ObjectiveFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'division_id' => fn (array $attributes): string => Division::factory()->create(['company_id' => $attributes['company_id']])->id,
            'quarter' => '2026-Q4',
            'title' => fake()->sentence(5),
            'description' => null,
            'owner_id' => fn (array $attributes): string => User::factory()->create(['company_id' => $attributes['company_id'], 'division_id' => $attributes['division_id']])->id,
            'status' => ObjectiveStatus::Active,
        ];
    }

    public function forDivision(Division $division): static
    {
        return $this->state(fn (): array => ['company_id' => $division->company_id, 'division_id' => $division->id]);
    }

    public function ownedBy(User $owner): static
    {
        return $this->state(fn (): array => ['owner_id' => $owner->id]);
    }

    public function closed(): static
    {
        return $this->state(fn (): array => ['status' => ObjectiveStatus::Closed, 'closed_at' => now()]);
    }

    public function draft(): static
    {
        return $this->state(fn (): array => ['status' => ObjectiveStatus::Draft]);
    }
}
