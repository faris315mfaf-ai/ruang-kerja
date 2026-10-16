<?php

namespace App\Http\Controllers\Api\Hiring;

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
 * Tab Wawancara (autosave, idempotent PUT per question): the candidate's
 * answer typed by HR, and the signed-in interviewer's own points + note.
 * Same actions, rules and JSON as the web autosave.
 */
class InterviewController extends Controller
{
    /**
     * PUT /hiring/kandidat/{candidate}/jawaban/{question} {answer|null}
     */
    public function answer(InterviewRequest $request, Candidate $candidate, HiringQuestion $question, #[CurrentUser] User $user, RecordInterviewAnswer $record): JsonResponse
    {
        Gate::authorize('manage', $candidate);
        abort_unless($question->position_id === $candidate->position_id, 404);

        $answer = $record->handle($user, $candidate, $question, $request->filled('answer') ? $request->string('answer')->toString() : null);

        return response()->json([
            'question_id' => $question->id,
            'answer' => $answer?->answer,
            'saved_at' => $answer?->updated_at?->toIso8601String(),
        ]);
    }

    /**
     * PUT /hiring/kandidat/{candidate}/poin/{question} {score|null, note|null}
     */
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
            'question_id' => $question->id,
            'max_score' => $question->max_score,
            'my_score' => $row === null ? null : ['score' => $row->score, 'note' => $row->note],
            'saved_at' => $row?->updated_at?->toIso8601String(),
        ]);
    }
}
