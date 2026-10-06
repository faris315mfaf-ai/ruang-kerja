<?php

namespace App\Policies;

use App\Models\AutomationRun;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Run log entries follow their rule (AutomationRulePolicy::view). Runs are
 * written by the system only; nobody edits or deletes them.
 */
class AutomationRunPolicy
{
    public function __construct(private readonly AutomationRulePolicy $rules) {}

    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, AutomationRun $run): Response
    {
        return $this->rules->view($user, $run->rule);
    }
}
