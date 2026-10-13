<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Actions\DecideCandidate;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\DecisionValue;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\DecisionRequest;
use App\Http\Resources\Api\Hiring\CandidateDetail;
use App\Models\Candidate;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Tab Keputusan: a final approver approves or rejects (note required when
 * rejecting) through the web DecideCandidate — the outcome is automatic
 * (one rejection → Ditolak, every active approver approved → Diterima).
 * A candidate that is no longer in "Keputusan akhir" (HR moved it, or it was
 * decided meanwhile) answers 409 `code: bukan_tahap_keputusan` with the
 * fresh profile, so the app shows "Keputusan Anda tidak disimpan" + Muat ulang.
 */
class DecisionController extends Controller
{
    public function __construct(private readonly CandidateDetail $detail) {}

    /**
     * POST /hiring/kandidat/{candidate}/keputusan {decision: approve|reject, note?}
     */
    public function store(DecisionRequest $request, Candidate $candidate, #[CurrentUser] User $user, DecideCandidate $decide): JsonResponse
    {
        if ($this->isStale($candidate, $user)) {
            return $this->conflict($candidate, $user);
        }

        Gate::authorize('decide', $candidate);

        $decision = DecisionValue::from($request->string('decision')->toString());

        try {
            $decide->handle($user, $candidate, $decision, $request->filled('note') ? $request->string('note')->toString() : null);
        } catch (ValidationException $exception) {
            // Moved or decided between our check and the row lock.
            $fresh = $candidate->fresh();

            if ($fresh !== null && $fresh->stage !== CandidateStage::FinalReview) {
                return $this->conflict($fresh, $user);
            }

            throw $exception;
        }

        $outcome = $candidate->stage->isFinal() ? $candidate->stage : null;

        return response()->json([
            'message' => match ($outcome) {
                CandidateStage::Hired => "Semua penyetuju setuju: {$candidate->full_name} diterima.",
                CandidateStage::Rejected => "{$candidate->full_name} ditolak.",
                default => 'Keputusan Anda dicatat. Menunggu penyetuju lain.',
            },
            'outcome' => $outcome?->value,
            'candidate' => $this->detail->make($candidate, $user),
        ]);
    }

    /** An approver of the position deciding on a candidate outside "Keputusan akhir". */
    private function isStale(Candidate $candidate, User $user): bool
    {
        return $candidate->stage !== CandidateStage::FinalReview
            && Gate::forUser($user)->allows('view', $candidate)
            && $candidate->hiringPosition->isApprover($user);
    }

    private function conflict(Candidate $candidate, User $user): JsonResponse
    {
        return response()->json([
            'message' => 'Kandidat ini sudah diputus atau tidak lagi di tahap Keputusan akhir. Keputusan Anda tidak disimpan.',
            'code' => 'bukan_tahap_keputusan',
            'candidate' => $this->detail->make($candidate, $user),
        ], 409);
    }
}
