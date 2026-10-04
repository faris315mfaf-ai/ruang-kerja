<?php

namespace App\Policies;

use App\Models\ApprovalFlowStep;
use App\Models\User;

/**
 * Steps are edited as part of their flow.
 */
class ApprovalFlowStepPolicy
{
    public function __construct(private readonly ApprovalFlowPolicy $flows) {}

    public function view(User $actor, ApprovalFlowStep $step): bool
    {
        return $this->flows->view($actor, $step->flow);
    }

    public function update(User $actor, ApprovalFlowStep $step): bool
    {
        return $this->flows->update($actor, $step->flow);
    }

    public function delete(User $actor, ApprovalFlowStep $step): bool
    {
        return $this->flows->update($actor, $step->flow);
    }
}
