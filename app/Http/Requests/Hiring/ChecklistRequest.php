<?php

namespace App\Http\Requests\Hiring;

use Illuminate\Contracts\Validation\ValidationRule;

/** New checklist item (HR) or ticking an own item (+ note). */
class ChecklistRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        if ($this->isMethod('post')) {
            return [
                'label' => ['required', 'string', 'min:2', 'max:200'],
                'reviewer_id' => ['nullable', 'string', 'ulid'],
                'required' => ['sometimes', 'boolean'],
            ];
        }

        return [
            'checked' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['label' => 'butir', 'reviewer_id' => 'pemeriksa', 'note' => 'catatan'];
    }
}
