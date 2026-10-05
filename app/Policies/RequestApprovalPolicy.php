<?php

namespace App\Policies;

use App\Domain\Requests\Services\ApprovalQueue;
use App\Models\RequestApproval;
use App\Models\User;

/**
 * A step is visible with its request; deciding follows ApprovalQueue::canDecide.
 */
class RequestApprovalPolicy
{
    public function __construct(
        private readonly ApprovalQueue $queue,
        private readonly EmployeeRequestPolicy $requests,
    ) {}

    public function view(User $actor, RequestApproval $step): bool
    {
        return $this->requests->view($actor, $step->loadMissing('request')->request);
    }

    public function decide(User $actor, RequestApproval $step): bool
    {
        return $this->queue->canDecide($actor, $step);
    }

    public function update(User $actor, RequestApproval $step): bool
    {
        return false;
    }

    public function delete(User $actor, RequestApproval $step): bool
    {
        return false;
    }
}
