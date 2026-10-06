<?php

namespace App\Domain\Hiring\Actions;

use App\Models\Candidate;
use App\Models\HiringQuestion;
use App\Models\InterviewScore;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * An interviewer gives their own points (1..max) and an optional note for
 * one question. Only the signed-in interviewer's row is ever written; a null
 * score with no note clears it.
 */
final class ScoreInterviewQuestion
{
    public function handle(User $interviewer, Candidate $candidate, HiringQuestion $question, ?int $score, ?string $note): ?InterviewScore
    {
        if ($question->position_id !== $candidate->position_id) {
            throw ValidationException::withMessages(['question' => 'Pertanyaan ini bukan milik lowongan kandidat.']);
        }

        $note = CreateHiringPosition::text($note);

        if ($score === null && $note === null) {
            InterviewScore::query()
                ->where('candidate_id', $candidate->id)
                ->where('question_id', $question->id)
                ->where('interviewer_id', $interviewer->id)
                ->delete();

            return null;
        }

        if ($score === null) {
            throw ValidationException::withMessages(['score' => 'Pilih poin dulu sebelum menulis catatan.']);
        }

        if ($score < 1 || $score > $question->max_score) {
            throw ValidationException::withMessages(['score' => "Poin harus antara 1 dan {$question->max_score}."]);
        }

        return InterviewScore::query()->updateOrCreate(
            ['candidate_id' => $candidate->id, 'question_id' => $question->id, 'interviewer_id' => $interviewer->id],
            ['score' => $score, 'note' => $note === null ? null : mb_substr($note, 0, 5000)],
        );
    }
}
