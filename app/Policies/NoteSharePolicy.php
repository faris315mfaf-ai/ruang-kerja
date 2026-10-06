<?php

namespace App\Policies;

use App\Models\NoteShare;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Share rows follow their note: visible to whoever opens the note, changed
 * only through UpdateNoteShare (NotePolicy::share).
 */
class NoteSharePolicy
{
    public function __construct(private readonly NotePolicy $notes) {}

    public function view(User $user, NoteShare $share): Response
    {
        return $this->notes->view($user, $share->note);
    }

    public function update(User $user, NoteShare $share): Response
    {
        return $this->notes->share($user, $share->note);
    }

    public function delete(User $user, NoteShare $share): Response
    {
        return $this->notes->share($user, $share->note);
    }
}
