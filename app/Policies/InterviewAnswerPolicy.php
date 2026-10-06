<?php

namespace App\Policies;

use App\Models\InterviewAnswer;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Candidate answers typed during the interview: every reviewer reads them,
 * HR writes them.
 */
class InterviewAnswerPolicy
{
    public function __construct(private readonly CandidatePolicy $candidates) {}

    public function view(User $user, InterviewAnswer $answer): Response
    {
        return $this->candidates->view($user, $answer->candidate);
    }

    public function update(User $user, InterviewAnswer $answer): Response
    {
        return $this->candidates->manage($user, $answer->candidate);
    }
}
