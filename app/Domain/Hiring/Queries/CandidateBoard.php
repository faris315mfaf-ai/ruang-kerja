<?php

namespace App\Domain\Hiring\Queries;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Models\Candidate;
use App\Models\HiringPosition;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The "Kandidat" tab of /hiring: every visible candidate (optionally of one
 * position / matching a search) as cards per stage, plus the position filter.
 * Constant number of queries.
 */
final class CandidateBoard
{
    public const int LIMIT = 500;

    /**
     * @return array{positions: list<array{id: string, title: string, status: string}>, candidates: list<array<string, mixed>>, truncated: bool}
     */
    public function for(User $viewer, ?string $positionId, ?string $search): array
    {
        $positions = HiringPosition::query()->visibleTo($viewer)
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END")
            ->orderBy('title')
            ->get(['id', 'title', 'status']);

        $query = Candidate::query()->visibleTo($viewer)
            ->with('hiringPosition:id,title,final_approver_ids,deleted_at')
            ->withCount([
                'checklistItems as required_total' => fn (Builder $items) => $items->where('is_required', true),
                'checklistItems as required_done' => fn (Builder $items) => $items->where('is_required', true)->whereNotNull('checked_at'),
            ])
            ->withExists(['decisions as decided_by_me' => fn (Builder $decisions) => $decisions->where('approver_id', $viewer->id)])
            ->orderByDesc('applied_at')
            ->orderByDesc('id');

        if ($positionId !== null && $positions->contains('id', $positionId)) {
            $query->where('position_id', $positionId);
        }

        $search = trim((string) $search);

        if ($search !== '') {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->where(fn (Builder $match) => $match->where('full_name', 'ilike', $like)->orWhere('email', 'ilike', $like));
        }

        $candidates = $query->limit(self::LIMIT + 1)->get([
            'id', 'company_id', 'position_id', 'full_name', 'email', 'cv_url', 'stage', 'source', 'applied_at', 'decided_at', 'deleted_at',
        ]);

        return [
            'positions' => array_values($positions->map(fn (HiringPosition $position): array => [
                'id' => $position->id,
                'title' => $position->title,
                'status' => $position->status->value,
            ])->all()),
            'candidates' => array_values($candidates->take(self::LIMIT)->map(fn (Candidate $candidate): array => [
                'id' => $candidate->id,
                'full_name' => $candidate->full_name,
                'email' => $candidate->email,
                'position' => ['id' => $candidate->position_id, 'title' => $candidate->hiringPosition->title],
                'stage' => $candidate->stage->value,
                'source' => $candidate->source->value,
                'applied_at' => $candidate->applied_at->toIso8601String(),
                'has_cv' => $candidate->cv_url !== null,
                'checklist' => [
                    'done' => (int) $candidate->getAttribute('required_done'),
                    'total' => (int) $candidate->getAttribute('required_total'),
                ],
                'awaiting_me' => $candidate->stage === CandidateStage::FinalReview
                    && $candidate->hiringPosition->isApprover($viewer)
                    && ! (bool) $candidate->getAttribute('decided_by_me'),
            ])->all()),
            'truncated' => $candidates->count() > self::LIMIT,
        ];
    }
}
