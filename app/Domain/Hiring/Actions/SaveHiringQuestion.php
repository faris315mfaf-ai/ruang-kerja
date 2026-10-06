<?php

namespace App\Domain\Hiring\Actions;

use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use Illuminate\Validation\ValidationException;

/**
 * Adds a question at the end of a position's list, or edits one. The maximum
 * points cannot drop below points already given for the question.
 */
final class SaveHiringQuestion
{
    /**
     * @param  array{prompt: string, guidance?: string|null, max_score: int}  $data
     */
    public function handle(HiringPosition $position, ?HiringQuestion $question, array $data): HiringQuestion
    {
        if ($question !== null && $data['max_score'] < $question->max_score) {
            $highest = (int) $question->scores()->max('score');

            if ($highest > $data['max_score']) {
                throw ValidationException::withMessages([
                    'max_score' => "Sudah ada poin {$highest} untuk pertanyaan ini; poin maksimal tidak boleh lebih kecil.",
                ]);
            }
        }

        $question ??= new HiringQuestion([
            'position_id' => $position->id,
            'position' => (int) $position->questions()->max('position') + 1,
        ]);

        $question->fill([
            'prompt' => trim($data['prompt']),
            'guidance' => CreateHiringPosition::text($data['guidance'] ?? null),
            'max_score' => $data['max_score'],
        ])->save();

        return $question;
    }
}
