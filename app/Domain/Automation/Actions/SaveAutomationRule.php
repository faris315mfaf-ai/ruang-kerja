<?php

namespace App\Domain\Automation\Actions;

use App\Domain\Automation\Enums\RuleTriggerType;
use App\Models\AutomationRule;
use App\Models\User;
use App\Models\Workspace;

/**
 * Creates a rule in $workspace, or updates $rule (its workspace may change
 * when the person manages both; the controller checks). Input is validated
 * and normalized by AutomationRuleRequest (loop guard included).
 */
final class SaveAutomationRule
{
    /**
     * @param  array{name: string, trigger: array<string, mixed>, condition: array<string, mixed>|null, actions: list<array<string, mixed>>, is_active?: bool}  $data
     */
    public function handle(Workspace $workspace, User $actor, array $data, ?AutomationRule $rule = null): AutomationRule
    {
        $rule ??= new AutomationRule(['created_by' => $actor->id, 'is_active' => true]);

        $rule->fill([
            'company_id' => $workspace->company_id,
            'workspace_id' => $workspace->id,
            'name' => trim($data['name']),
            'trigger_type' => RuleTriggerType::from((string) $data['trigger']['type']),
            'trigger' => $data['trigger'],
            'condition' => $data['condition'],
            'actions' => $data['actions'],
        ]);

        if (array_key_exists('is_active', $data)) {
            $rule->is_active = $data['is_active'];
        }

        $rule->save();

        return $rule;
    }
}
