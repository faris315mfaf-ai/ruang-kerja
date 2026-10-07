<?php

namespace App\Domain\Hiring\Actions;

use App\Models\CandidateNote;

/**
 * The author removes their own interview minutes (CandidateNotePolicy).
 */
final class DeleteCandidateNote
{
    public function handle(CandidateNote $note): void
    {
        $note->delete();
    }
}
