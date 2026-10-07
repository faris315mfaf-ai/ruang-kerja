<?php

namespace App\Http\Requests\Hiring;

use App\Domain\Hiring\Enums\DecisionValue;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class DecisionRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::enum(DecisionValue::class)],
            'note' => [Rule::requiredIf($this->input('decision') === DecisionValue::Reject->value), 'nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['decision' => 'keputusan', 'note' => 'alasan'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['note.required' => 'Tulis alasan penolakan.'];
    }
}
