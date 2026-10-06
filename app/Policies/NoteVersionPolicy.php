<?php

namespace App\Policies;

use App\Models\NoteVersion;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Versions follow their note: whoever opens the note reads its history;
 * restoring needs edit rights (NotePolicy::update). Versions are never edited
 * or deleted on their own.
 */
class NoteVersionPolicy
{
    public function __construct(private readonly NotePolicy $notes) {}

    public function view(User $user, NoteVersion $version): Response
    {
        $note = $version->note;

        return $this->notes->canView($user, $note) ? Response::allow() : Response::denyAsNotFound();
    }

    public function restore(User $user, NoteVersion $version): Response
    {
        return $this->notes->update($user, $version->note);
    }
}
