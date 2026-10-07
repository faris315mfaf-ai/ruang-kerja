<?php

namespace App\Domain\Automation\Actions;

use App\Models\AutomationRule;

/**
 * Deletes a rule and its run log (cascade). Changes it already made to tasks
 * stay.
 */
final class DeleteAutomationRule
{
    public function handle(AutomationRule $rule): void
    {
        $rule->delete();
    }
}
