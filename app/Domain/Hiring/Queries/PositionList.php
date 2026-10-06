<?php

namespace App\Domain\Hiring\Queries;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The "Lowongan" tab: visible positions with their candidate counts and the
 * viewer's role on each. Two queries.
 */
final class PositionList
{
    /**
     * @return list<array<string, mixed>>
     */
    public function for(User $viewer): array
    {
        $open = array_map(fn (CandidateStage $stage): string => $stage->value, CandidateStage::open());

        return array_values(HiringPosition::query()->visibleTo($viewer)
            ->with('division:id,name')
            ->withCount([
                'candidates',
                'candidates as open_candidates_count' => fn (Builder $query) => $query->whereIn('stage', $open),
                'candidates as hired_count' => fn (Builder $query) => $query->where('stage', CandidateStage::Hired),
            ])
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (HiringPosition $position): array => [
                'id' => $position->id,
                'title' => $position->title,
                'status' => $position->status->value,
                'division' => $position->division?->name,
                'description' => $position->description,
                'opened_at' => $position->opened_at?->toIso8601String(),
                'closed_at' => $position->closed_at?->toIso8601String(),
                'candidates_count' => (int) $position->getAttribute('candidates_count'),
                'open_candidates_count' => (int) $position->getAttribute('open_candidates_count'),
                'hired_count' => (int) $position->getAttribute('hired_count'),
                'interviewers_count' => count($position->interviewer_ids),
                'approvers_count' => count($position->final_approver_ids),
                'my_roles' => array_values(array_filter([
                    $position->isInterviewer($viewer) ? 'interviewer' : null,
                    $position->isApprover($viewer) ? 'approver' : null,
                ])),
            ])
            ->all());
    }
}
