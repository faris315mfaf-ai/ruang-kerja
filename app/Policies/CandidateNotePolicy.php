<?php

namespace App\Policies;

use App\Models\CandidateNote;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Interview minutes: every reviewer of the candidate reads them; only the
 * author edits or deletes their own.
 */
class CandidateNotePolicy
{
    public function __construct(private readonly CandidatePolicy $candidates) {}

    public function view(User $user, CandidateNote $note): Response
    {
        return $this->candidates->view($user, $note->candidate);
    }

    public function update(User $user, CandidateNote $note): Response
    {
        return $this->own($user, $note);
    }

    public function delete(User $user, CandidateNote $note): Response
    {
        return $this->own($user, $note);
    }

    private function own(User $user, CandidateNote $note): Response
    {
        if (! $this->candidates->canView($user, $note->candidate)) {
            return Response::denyAsNotFound();
        }

        return $note->author_id === $user->id
            ? Response::allow()
            : Response::deny('Anda hanya dapat mengubah notulensi milik Anda.');
    }
}
