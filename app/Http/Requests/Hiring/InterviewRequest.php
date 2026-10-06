<?php

namespace App\Http\Requests\Hiring;

use Illuminate\Contracts\Validation\ValidationRule;

/** Autosaved interview fields: the candidate's answer (HR) or own points + note (interviewer). */
class InterviewRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'answer' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'score' => ['sometimes', 'nullable', 'integer', 'between:1,10'],
            'note' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['answer' => 'jawaban', 'score' => 'poin', 'note' => 'catatan'];
    }
}
