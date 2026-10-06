<?php

namespace App\Domain\Automation\Actions;

use App\Models\AutomationRule;

/**
 * Pause / resume a rule (the switch in the list). A paused rule never runs.
 */
final class SetAutomationRuleActive
{
    public function handle(AutomationRule $rule, bool $active): AutomationRule
    {
        $rule->is_active = $active;
        $rule->save();

        return $rule;
    }
}
