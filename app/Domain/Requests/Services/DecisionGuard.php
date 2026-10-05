<?php

namespace App\Domain\Requests\Services;

use App\Models\EmployeeRequest;
use App\Models\RequestApproval;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Locks a request for a decision and returns the step the actor may decide.
 * Call inside a transaction.
 */
final class DecisionGuard
{
    public function __construct(private readonly ApprovalQueue $queue) {}

    /**
     * @return array{0: EmployeeRequest, 1: RequestApproval}
     *
     * @throws AuthorizationException
     */
    public function lock(User $actor, EmployeeRequest $request): array
    {
        $locked = EmployeeRequest::query()
            ->lockForUpdate()
            ->with(['user', 'leaveType', 'substitute', 'approvals.approver'])
            ->findOrFail($request->id);

        $step = $locked->waitingStep();

        if ($step === null) {
            throw new AuthorizationException('Pengajuan ini sudah diputus atau tidak sedang menunggu persetujuan.');
        }

        $step->setRelation('request', $locked);

        if (! $this->queue->canDecide($actor, $step)) {
            throw new AuthorizationException('Anda tidak bisa memutus pengajuan ini.');
        }

        return [$locked, $step];
    }
}
