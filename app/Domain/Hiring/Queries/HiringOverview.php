<?php

namespace App\Domain\Hiring\Queries;

use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Services\HiringAccess;
use App\Models\Candidate;
use App\Models\HiringPosition;
use App\Models\User;

/**
 * The Hiring "workspace" card and page header: open positions, new
 * applicants ("Masuk") and candidates waiting for a final decision (for an
 * approver: waiting for *their* decision). Two queries.
 */
final class HiringOverview
{
    public function __construct(private readonly HiringAccess $access) {}

    /**
     * @return array{can_manage: bool, counts: array{open_positions: int, new_candidates: int, awaiting_decision: int}}
     */
    public function for(User $user): array
    {
        $manager = $this->access->isManager($user);

        $openPositions = HiringPosition::query()->visibleTo($user)
            ->where('status', PositionStatus::Open)
            ->count();

        $awaiting = $manager
            ? "COUNT(*) FILTER (WHERE candidates.stage = 'final_review')"
            : "COUNT(*) FILTER (WHERE candidates.stage = 'final_review' AND hiring_positions.final_approver_ids @> ?::jsonb AND NOT EXISTS (SELECT 1 FROM candidate_decisions d WHERE d.candidate_id = candidates.id AND d.approver_id = ?))";

        $row = Candidate::query()->visibleTo($user)
            ->join('hiring_positions', 'hiring_positions.id', '=', 'candidates.position_id')
            ->toBase()
            ->selectRaw("COUNT(*) FILTER (WHERE candidates.stage = 'applied') AS new_candidates")
            ->selectRaw("{$awaiting} AS awaiting_decision", $manager ? [] : [json_encode([$user->id]), $user->id])
            ->first();

        return [
            'can_manage' => $manager,
            'counts' => [
                'open_positions' => $openPositions,
                'new_candidates' => (int) ($row->new_candidates ?? 0),
                'awaiting_decision' => (int) ($row->awaiting_decision ?? 0),
            ],
        ];
    }

    /**
     * Card on /workspace; null when the user has no access to Hiring.
     *
     * @return array{can_manage: bool, counts: array{open_positions: int, new_candidates: int, awaiting_decision: int}}|null
     */
    public function card(User $user): ?array
    {
        return $this->access->canEnter($user) ? $this->for($user) : null;
    }
}
