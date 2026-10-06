<?php

namespace App\Domain\Hiring\Actions;

use App\Models\Candidate;
use App\Models\HiringQuestion;
use App\Models\InterviewAnswer;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * HR types the candidate's answer during the interview (autosaved). An empty
 * answer removes it.
 */
final class RecordInterviewAnswer
{
    public const int MAX_LENGTH = 20000;

    public function handle(User $actor, Candidate $candidate, HiringQuestion $question, ?string $answer): ?InterviewAnswer
    {
        if ($question->position_id !== $candidate->position_id) {
            throw ValidationException::withMessages(['question' => 'Pertanyaan ini bukan milik lowongan kandidat.']);
        }

        $answer = trim((string) $answer);

        if ($answer === '') {
            InterviewAnswer::query()->where('candidate_id', $candidate->id)->where('question_id', $question->id)->delete();

            return null;
        }

        return InterviewAnswer::query()->updateOrCreate(
            ['candidate_id' => $candidate->id, 'question_id' => $question->id],
            ['answer' => mb_substr($answer, 0, self::MAX_LENGTH), 'recorded_by' => $actor->id],
        );
    }
}
