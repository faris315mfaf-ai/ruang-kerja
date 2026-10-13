<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Actions\DeleteHiringQuestion;
use App\Domain\Hiring\Actions\ReorderHiringQuestions;
use App\Domain\Hiring\Actions\SaveHiringQuestion;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\QuestionRequest;
use App\Http\Requests\Hiring\ReorderQuestionsRequest;
use App\Http\Resources\Api\Hiring\PositionDetail;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Interview questions of a position (HR): add, edit (max points never below
 * points already given), reorder, delete while no answer or points refer to
 * them. Every response carries the position's full, ordered question list.
 */
class QuestionController extends Controller
{
    /**
     * POST /hiring/lowongan/{position}/pertanyaan {prompt, guidance?, max_score}
     */
    public function store(QuestionRequest $request, HiringPosition $position, SaveHiringQuestion $save): JsonResponse
    {
        Gate::authorize('update', $position);

        $question = $save->handle($position, null, $this->payload($request));

        return response()->json([
            'message' => 'Pertanyaan ditambahkan.',
            'question_id' => $question->id,
            'questions' => PositionDetail::questions($position),
        ], 201);
    }

    /**
     * PUT /hiring/pertanyaan/{question}
     */
    public function update(QuestionRequest $request, HiringQuestion $question, SaveHiringQuestion $save): JsonResponse
    {
        Gate::authorize('update', $question);

        $position = $question->hiringPosition;
        $save->handle($position, $question, $this->payload($request));

        return response()->json([
            'message' => 'Pertanyaan disimpan.',
            'question_id' => $question->id,
            'questions' => PositionDetail::questions($position),
        ]);
    }

    /**
     * DELETE /hiring/pertanyaan/{question}
     */
    public function destroy(HiringQuestion $question, DeleteHiringQuestion $delete): JsonResponse
    {
        Gate::authorize('delete', $question);

        $position = $question->hiringPosition;
        $delete->handle($question);

        return response()->json([
            'message' => 'Pertanyaan dihapus.',
            'questions' => PositionDetail::questions($position),
        ]);
    }

    /**
     * PUT /hiring/lowongan/{position}/urutan-pertanyaan {ids: [...]}
     */
    public function reorder(ReorderQuestionsRequest $request, HiringPosition $position, ReorderHiringQuestions $reorder): JsonResponse
    {
        Gate::authorize('update', $position);

        $reorder->handle($position, $request->ids());

        return response()->json(['questions' => PositionDetail::questions($position)]);
    }

    /**
     * @return array{prompt: string, guidance: string|null, max_score: int}
     */
    private function payload(QuestionRequest $request): array
    {
        return [
            'prompt' => $request->string('prompt')->toString(),
            'guidance' => $request->filled('guidance') ? $request->string('guidance')->toString() : null,
            'max_score' => $request->integer('max_score'),
        ];
    }
}
