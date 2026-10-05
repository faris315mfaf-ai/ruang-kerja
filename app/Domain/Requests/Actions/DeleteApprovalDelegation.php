<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Models\ApprovalDelegation;
use App\Models\User;

/**
 * Ends a delegation. Steps already routed to the delegate stay with them.
 */
final class DeleteApprovalDelegation
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, ApprovalDelegation $delegation): void
    {
        $this->audit->log('approval_delegation.deleted', $delegation, [
            'delegate_id' => $delegation->delegate_id,
            'starts_on' => $delegation->starts_on->toDateString(),
            'ends_on' => $delegation->ends_on->toDateString(),
        ], null, $actor);

        $delegation->delete();
    }
}
