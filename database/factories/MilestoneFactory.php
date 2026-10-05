<?php

namespace Database\Factories;

use App\Models\Milestone;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Milestone>
 */
class MilestoneFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->randomElement(['Konsep disetujui', 'Vendor terkunci', 'Uji coba', 'Serah terima', 'Peluncuran']),
            'target_date' => now()->addDays(fake()->numberBetween(1, 60))->toDateString(),
            'position' => 'V'.strtoupper(fake()->unique()->lexify('????')),
        ];
    }

    public function completed(?string $at = null): static
    {
        return $this->state(fn (): array => ['completed_at' => $at ?? now()]);
    }
}
