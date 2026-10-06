<?php

namespace App\Domain\Automation\Actions;

use App\Models\AutomationRule;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * "Duplikat": a paused copy "<nama> (salinan)" without run history.
 */
final class DuplicateAutomationRule
{
    public function handle(AutomationRule $rule, User $actor): AutomationRule
    {
        $copy = $rule->replicate(['run_count', 'last_run_at', 'created_at', 'updated_at']);
        $copy->name = Str::limit($rule->name, 69, '').' (salinan)';
        $copy->is_active = false;
        $copy->run_count = 0;
        $copy->last_run_at = null;
        $copy->created_by = $actor->id;
        $copy->save();

        return $copy;
    }
}
