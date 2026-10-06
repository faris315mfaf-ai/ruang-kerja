<?php

namespace Database\Factories;

use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\WorkspaceTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Default: project template with four columns and two labels.
 *
 * @extends Factory<WorkspaceTemplate>
 */
class WorkspaceTemplateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => fn (): string => CompanyFactory::defaultId(),
            'name' => 'Proyek '.fake()->unique()->word(),
            'description' => 'Kolom standar proyek.',
            'type' => WorkspaceType::Project,
            'statuses' => [
                ['name' => 'Ide', 'category' => 'backlog', 'color' => 'gray'],
                ['name' => 'Rencana', 'category' => 'todo', 'color' => 'slate'],
                ['name' => 'Dikerjakan', 'category' => 'in_progress', 'color' => 'blue'],
                ['name' => 'Rampung', 'category' => 'done', 'color' => 'green'],
            ],
            'labels' => [
                ['name' => 'Desain', 'color' => 'violet'],
                ['name' => 'Konten', 'color' => 'teal'],
            ],
        ];
    }
}
