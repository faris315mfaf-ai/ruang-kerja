<?php

namespace Database\Factories;

use App\Domain\Projects\Enums\ProjectHealth;
use App\Models\ProjectUpdate;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses PostProjectUpdate (no denormalization or notifications).
 *
 * @extends Factory<ProjectUpdate>
 */
class ProjectUpdateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'health' => ProjectHealth::OnTrack,
            'summary' => fake()->sentence(10),
        ];
    }

    public function withDecision(string $decision = 'Mohon persetujuan tambahan anggaran.'): static
    {
        return $this->state(fn (): array => ['decision_needed' => $decision]);
    }
}
