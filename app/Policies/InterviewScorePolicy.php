<?php

namespace App\Policies;

use App\Models\InterviewScore;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Interview points: HR & final approvers see all of them, an interviewer
 * only their own; only the interviewer changes their points.
 */
class InterviewScorePolicy
{
    public function __construct(private readonly CandidatePolicy $candidates) {}

    public function view(User $user, InterviewScore $score): Response
    {
        if (! $this->candidates->canView($user, $score->candidate)) {
            return Response::denyAsNotFound();
        }

        return $score->interviewer_id === $user->id || $this->candidates->canSeeAllScores($user, $score->candidate)
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function update(User $user, InterviewScore $score): Response
    {
        $allowed = $this->candidates->score($user, $score->candidate);

        if ($allowed->denied()) {
            return $allowed;
        }

        return $score->interviewer_id === $user->id
            ? Response::allow()
            : Response::deny('Anda hanya dapat mengubah poin milik Anda.');
    }
}
