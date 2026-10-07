<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\RecordInterviewAnswer;
use App\Domain\Hiring\Actions\ScoreInterviewQuestion;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\InterviewRequest;
use App\Models\Candidate;
use App\Models\HiringQuestion;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Autosave endpoints of the Wawancara tab (JSON): the candidate's answer
 * (HR) and the interviewer's own points + note.
 */
class InterviewController extends Controller
{
    public function answer(InterviewRequest $request, Candidate $candidate, HiringQuestion $question, #[CurrentUser] User $user, RecordInterviewAnswer $record): JsonResponse
    {
        Gate::authorize('manage', $candidate);
        abort_unless($question->position_id === $candidate->position_id, 404);

        $answer = $record->handle($user, $candidate, $question, $request->filled('answer') ? $request->string('answer')->toString() : null);

        return response()->json([
            'answer' => $answer?->answer,
            'saved_at' => $answer?->updated_at?->toIso8601String(),
        ]);
    }

    public function score(InterviewRequest $request, Candidate $candidate, HiringQuestion $question, #[CurrentUser] User $user, ScoreInterviewQuestion $score): JsonResponse
    {
        Gate::authorize('score', $candidate);
        abort_unless($question->position_id === $candidate->position_id, 404);

        $row = $score->handle(
            $user,
            $candidate,
            $question,
            $request->filled('score') ? $request->integer('score') : null,
            $request->filled('note') ? $request->string('note')->toString() : null,
        );

        return response()->json([
            'my_score' => $row === null ? null : ['score' => $row->score, 'note' => $row->note],
        ]);
    }
}
