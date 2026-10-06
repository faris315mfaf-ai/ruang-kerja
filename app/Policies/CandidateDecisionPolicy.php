<?php

namespace App\Policies;

use App\Models\CandidateDecision;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Final decisions are read by everyone who sees the candidate; they are
 * written through CandidatePolicy::decide (DecideCandidate).
 */
class CandidateDecisionPolicy
{
    public function __construct(private readonly CandidatePolicy $candidates) {}

    public function view(User $user, CandidateDecision $decision): Response
    {
        return $this->candidates->view($user, $decision->candidate);
    }
}
