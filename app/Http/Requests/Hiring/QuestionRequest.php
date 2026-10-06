<?php

namespace App\Http\Requests\Hiring;

use Illuminate\Contracts\Validation\ValidationRule;

/** Interview question of a position (prompt, guidance for interviewers, max points). */
class QuestionRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'prompt' => ['required', 'string', 'min:3', 'max:2000'],
            'guidance' => ['nullable', 'string', 'max:2000'],
            'max_score' => ['required', 'integer', 'between:1,10'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['prompt' => 'pertanyaan', 'guidance' => 'panduan', 'max_score' => 'poin maksimal'];
    }
}
