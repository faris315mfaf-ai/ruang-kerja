<?php

namespace Database\Factories;

use App\Domain\Automation\Enums\RuleTriggerType;
use App\Models\AutomationRule;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Default: "pindah ke Review → beri tahu penanggung jawab".
 *
 * @extends Factory<AutomationRule>
 */
class AutomationRuleFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'company_id' => fn (array $attributes): string => (string) Workspace::query()->whereKey((string) $attributes['workspace_id'])->value('company_id'),
            'name' => 'Aturan '.fake()->unique()->numberBetween(1, 9999),
            'trigger_type' => RuleTriggerType::TaskMoved,
            'trigger' => ['type' => 'task_moved', 'category' => 'review'],
            'condition' => null,
            'actions' => [['type' => 'notify', 'target' => ['kind' => 'assignees']]],
            'is_active' => true,
        ];
    }

    public function forWorkspace(Workspace $workspace): static
    {
        return $this->state(fn (): array => [
            'workspace_id' => $workspace->id,
            'company_id' => $workspace->company_id,
            'created_by' => $workspace->owner_id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $trigger
     */
    public function trigger(array $trigger): static
    {
        return $this->state(fn (): array => [
            'trigger_type' => RuleTriggerType::from((string) $trigger['type']),
            'trigger' => $trigger,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $actions
     */
    public function actions(array $actions): static
    {
        return $this->state(fn (): array => ['actions' => $actions]);
    }

    public function paused(): static
    {
        return $this->state(fn (): array => ['is_active' => false]);
    }
}
