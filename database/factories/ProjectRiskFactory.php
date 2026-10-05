<?php

namespace Database\Factories;

use App\Domain\Projects\Enums\RiskLevel;
use App\Models\ProjectRisk;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectRisk>
 */
class ProjectRiskFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'title' => fake()->sentence(5),
            'level' => RiskLevel::Medium,
        ];
    }
}
