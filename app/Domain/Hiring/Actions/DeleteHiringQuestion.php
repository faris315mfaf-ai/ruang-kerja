<?php

namespace App\Domain\Hiring\Actions;

use App\Models\HiringQuestion;
use Illuminate\Validation\ValidationException;

/**
 * Removes a question that has no answer or points yet (HiringQuestionPolicy
 * refuses otherwise; checked again here against a race).
 */
final class DeleteHiringQuestion
{
    public function handle(HiringQuestion $question): void
    {
        if ($question->answers()->exists() || $question->scores()->exists()) {
            throw ValidationException::withMessages(['question' => 'Pertanyaan yang sudah punya jawaban atau poin tidak bisa dihapus.']);
        }

        $question->delete();
    }
}
