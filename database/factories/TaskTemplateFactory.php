<?php

namespace Database\Factories;

use App\Models\TaskTemplate;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Default: company-wide template with a three-line checklist.
 *
 * @extends Factory<TaskTemplate>
 */
class TaskTemplateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'workspace_id' => null,
            'name' => 'Template '.fake()->unique()->numberBetween(1, 9999),
            'description' => 'Langkah standar.',
            'title' => 'Kunjungan [klien]',
            'priority' => 3,
            'estimate_hours' => 2,
            'checklist' => ['Siapkan bahan', 'Lakukan kunjungan', 'Tulis laporan'],
            'labels' => [],
        ];
    }

    public function forWorkspace(Workspace $workspace): static
    {
        return $this->state(fn (): array => ['workspace_id' => $workspace->id, 'company_id' => $workspace->company_id]);
    }
}
