<?php

namespace App\Policies;

use App\Models\HiringQuestion;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Interview questions follow their position: reviewers read, HR edits.
 * Deleting is refused once an answer or points refer to the question.
 */
class HiringQuestionPolicy
{
    public function __construct(private readonly HiringPositionPolicy $positions) {}

    public function view(User $user, HiringQuestion $question): Response
    {
        return $this->positions->view($user, $question->loadMissing('hiringPosition')->hiringPosition);
    }

    public function update(User $user, HiringQuestion $question): Response
    {
        return $this->positions->update($user, $question->loadMissing('hiringPosition')->hiringPosition);
    }

    public function delete(User $user, HiringQuestion $question): Response
    {
        $allowed = $this->positions->update($user, $question->loadMissing('hiringPosition')->hiringPosition);

        if ($allowed->denied()) {
            return $allowed;
        }

        return $question->answers()->exists() || $question->scores()->exists()
            ? Response::deny('Pertanyaan yang sudah punya jawaban atau poin tidak bisa dihapus.')
            : Response::allow();
    }
}
