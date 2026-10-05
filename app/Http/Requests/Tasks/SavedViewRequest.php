<?php

namespace App\Http\Requests\Tasks;

use App\Domain\Tasks\Enums\SavedViewLayout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create/update a saved view. Authorization in the controller (SavedViewPolicy).
 */
class SavedViewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $presence = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$presence, 'string', 'max:60'],
            'layout' => [$presence, Rule::enum(SavedViewLayout::class)],
            'filters' => ['sometimes', 'array'],
            'filters.assignees' => ['sometimes', 'array', 'max:50'],
            'filters.assignees.*' => ['string', 'max:26'],
            'filters.priorities' => ['sometimes', 'array', 'max:5'],
            'filters.priorities.*' => ['integer', 'between:0,4'],
            'filters.labels' => ['sometimes', 'array', 'max:50'],
            'filters.labels.*' => ['string', 'max:26'],
            'filters.due' => ['sometimes', 'nullable', Rule::in(['overdue', 'today', 'week', 'none'])],
            'filters.q' => ['sometimes', 'nullable', 'string', 'max:200'],
            'is_shared' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama tampilan wajib diisi.',
            'name.max' => 'Nama tampilan maksimal 60 karakter.',
            'layout.required' => 'Pilih tata letak.',
            'layout.enum' => 'Tata letak tidak valid.',
        ];
    }

    public function shared(): bool
    {
        return $this->boolean('is_shared');
    }
}
