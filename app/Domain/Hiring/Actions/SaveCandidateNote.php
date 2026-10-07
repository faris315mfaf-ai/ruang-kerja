<?php

namespace App\Domain\Hiring\Actions;

use App\Models\Candidate;
use App\Models\CandidateNote;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Adds interview minutes to a candidate, or edits the author's own entry
 * (CandidateNotePolicy).
 */
final class SaveCandidateNote
{
    public const int MAX_LENGTH = 20000;

    public function handle(User $author, Candidate $candidate, ?CandidateNote $note, string $body): CandidateNote
    {
        $body = mb_substr(trim($body), 0, self::MAX_LENGTH);

        if ($note === null) {
            return CandidateNote::query()->create([
                'candidate_id' => $candidate->id,
                'author_id' => $author->id,
                'body' => $body,
            ]);
        }

        if ($note->body !== $body) {
            $note->fill(['body' => $body, 'edited_at' => CarbonImmutable::now()])->save();
        }

        return $note;
    }
}
