<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\ReviewerRole;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * HR adds a checklist item for HR or for one of the position's reviewers
 * (an interviewer or a final approver ticks it themselves).
 */
final class AddChecklistItem
{
    public function handle(User $actor, Candidate $candidate, string $label, ?string $reviewerId, bool $required): CandidateChecklistItem
    {
        $position = $candidate->hiringPosition;

        $role = match (true) {
            $reviewerId === null => ReviewerRole::Hr,
            in_array($reviewerId, $position->final_approver_ids, true) && ! in_array($reviewerId, $position->interviewer_ids, true) => ReviewerRole::Approver,
            in_array($reviewerId, $position->interviewer_ids, true) => ReviewerRole::Interviewer,
            default => throw ValidationException::withMessages(['reviewer_id' => 'Pilih HR, pewawancara, atau penyetuju akhir lowongan ini.']),
        };

        return CandidateChecklistItem::query()->create([
            'candidate_id' => $candidate->id,
            'reviewer_id' => $reviewerId,
            'role' => $role,
            'label' => mb_substr(trim($label), 0, 200),
            'is_required' => $required,
            'position' => (int) $candidate->checklistItems()->max('position') + 1,
            'created_by' => $actor->id,
        ]);
    }
}
