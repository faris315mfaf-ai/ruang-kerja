<?php

namespace App\Domain\Hiring\Services;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\ReviewerRole;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\HiringPosition;
use App\Models\HiringSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Generates the per-reviewer checklist of a candidate from the company
 * template and keeps it in line with the position's interviewers and final
 * approvers: new reviewers get their items, removed reviewers lose the items
 * they had not ticked yet. HR items are created once, with the candidate.
 */
final class CandidateChecklist
{
    /**
     * Items for a new candidate: HR items plus one set per current reviewer.
     */
    public function seed(Candidate $candidate, HiringPosition $position): void
    {
        $template = HiringSetting::forCompany($candidate->company_id)->template();
        $index = 0;

        foreach ($template[ReviewerRole::Hr->value] as $item) {
            $this->create($candidate, ReviewerRole::Hr, null, $item, $index++);
        }

        $this->syncReviewers($candidate, $position, $template);
    }

    /**
     * Re-sync every open candidate of the position after its reviewers changed.
     */
    public function syncPosition(HiringPosition $position): void
    {
        $template = HiringSetting::forCompany($position->company_id)->template();

        Candidate::query()
            ->where('position_id', $position->id)
            ->whereIn('stage', array_map(fn (CandidateStage $stage): string => $stage->value, CandidateStage::open()))
            ->with('checklistItems')
            ->each(fn (Candidate $candidate) => $this->syncReviewers($candidate, $position, $template));
    }

    /**
     * Required HR & interviewer items not ticked yet (they must be done before
     * "Keputusan akhir").
     */
    public function openRequiredBeforeFinal(Candidate $candidate): int
    {
        // Items of interviewers who left the position or were deactivated no longer block.
        $interviewers = User::query()
            ->whereIn('id', $candidate->hiringPosition->interviewer_ids)
            ->where('status', UserStatus::Active)
            ->pluck('id')
            ->all();

        return $candidate->checklistItems()
            ->where('is_required', true)
            ->whereNull('checked_at')
            ->where(function (Builder $scope) use ($interviewers): void {
                $scope->where('role', ReviewerRole::Hr->value)
                    ->orWhere(fn (Builder $own) => $own->where('role', ReviewerRole::Interviewer->value)->whereIn('reviewer_id', $interviewers));
            })
            ->count();
    }

    /**
     * Same rule as openRequiredBeforeFinal() on an already loaded checklist.
     *
     * @param  list<string>  $activeInterviewerIds
     */
    public static function blocksFinal(CandidateChecklistItem $item, array $activeInterviewerIds): bool
    {
        return $item->is_required && ! $item->isChecked()
            && ($item->role === ReviewerRole::Hr
                || ($item->role === ReviewerRole::Interviewer && in_array($item->reviewer_id, $activeInterviewerIds, true)));
    }

    /**
     * Required items of one approver not ticked yet (needed before approving).
     */
    public function openRequiredFor(Candidate $candidate, string $userId, ReviewerRole $role): int
    {
        return $candidate->checklistItems()
            ->where('reviewer_id', $userId)
            ->where('role', $role->value)
            ->where('is_required', true)
            ->whereNull('checked_at')
            ->count();
    }

    /**
     * @param  array<string, list<array{label: string, required: bool}>>  $template
     */
    private function syncReviewers(Candidate $candidate, HiringPosition $position, array $template): void
    {
        $existing = $candidate->relationLoaded('checklistItems')
            ? $candidate->checklistItems
            : $candidate->checklistItems()->get();
        $next = (int) $existing->max('position') + 1;

        $wanted = [
            ReviewerRole::Interviewer->value => $position->interviewer_ids,
            ReviewerRole::Approver->value => $position->final_approver_ids,
        ];

        foreach ($wanted as $role => $userIds) {
            $roleEnum = ReviewerRole::from($role);
            $current = $existing->where('role', $roleEnum);

            // Reviewers taken off the position: drop what they had not ticked.
            $current->filter(fn (CandidateChecklistItem $item): bool => ! in_array($item->reviewer_id, $userIds, true) && ! $item->isChecked())
                ->each(fn (CandidateChecklistItem $item) => $item->delete());

            foreach ($userIds as $userId) {
                if ($current->contains('reviewer_id', $userId)) {
                    continue;
                }

                foreach ($template[$role] as $item) {
                    $this->create($candidate, $roleEnum, $userId, $item, $next++);
                }
            }
        }

        $candidate->unsetRelation('checklistItems');
    }

    /**
     * @param  array{label: string, required: bool}  $item
     */
    private function create(Candidate $candidate, ReviewerRole $role, ?string $reviewerId, array $item, int $position): void
    {
        CandidateChecklistItem::query()->create([
            'candidate_id' => $candidate->id,
            'reviewer_id' => $reviewerId,
            'role' => $role,
            'label' => $item['label'],
            'is_required' => $item['required'],
            'position' => $position,
        ]);
    }
}
