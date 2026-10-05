<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Enums\ApprovalStatus;
use App\Models\EmployeeRequest;
use App\Models\RequestApproval;

/**
 * Helper shared by reject / revision / cancel: open steps of the current round
 * become `skipped` with a note.
 *
 * @internal
 */
final class StopFlow
{
    public static function skipRemaining(EmployeeRequest $request, string $note): void
    {
        $request->currentSteps()
            ->filter(fn (RequestApproval $step): bool => in_array($step->status, [ApprovalStatus::Queued, ApprovalStatus::Waiting], true))
            ->each(fn (RequestApproval $step) => $step->fill(['status' => ApprovalStatus::Skipped, 'note' => $note])->save());
    }
}
