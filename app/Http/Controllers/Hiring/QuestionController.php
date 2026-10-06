<?php

namespace App\Http\Controllers\Hiring;

use App\Domain\Hiring\Actions\DeleteHiringQuestion;
use App\Domain\Hiring\Actions\ReorderHiringQuestions;
use App\Domain\Hiring\Actions\SaveHiringQuestion;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\QuestionRequest;
use App\Http\Requests\Hiring\ReorderQuestionsRequest;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Interview questions of a position (HR): add, edit, reorder, delete while
 * no answer or points refer to them.
 */
class QuestionController extends Controller
{
    public function store(QuestionRequest $request, HiringPosition $position, SaveHiringQuestion $save): RedirectResponse
    {
        Gate::authorize('update', $position);

        $save->handle($position, null, $this->payload($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pertanyaan ditambahkan.']);

        return back();
    }

    public function update(QuestionRequest $request, HiringQuestion $question, SaveHiringQuestion $save): RedirectResponse
    {
        Gate::authorize('update', $question);

        $save->handle($question->hiringPosition, $question, $this->payload($request));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pertanyaan disimpan.']);

        return back();
    }

    public function destroy(HiringQuestion $question, DeleteHiringQuestion $delete): RedirectResponse
    {
        Gate::authorize('delete', $question);

        $delete->handle($question);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pertanyaan dihapus.']);

        return back();
    }

    public function reorder(ReorderQuestionsRequest $request, HiringPosition $position, ReorderHiringQuestions $reorder): RedirectResponse
    {
        Gate::authorize('update', $position);

        $reorder->handle($position, $request->ids());

        return back();
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
