<?php

namespace App\Http\Requests\Api;

use App\Domain\Search\Actions\RunApiSearch;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * GET /api/v1/cari?q=&tipe= — global search for the mobile app.
 */
class SearchApiRequest extends FormRequest
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
        return [
            'q' => ['required', 'string', 'min:2', 'max:100'],
            'tipe' => ['nullable', 'string', Rule::in(RunApiSearch::TYPES)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.required' => 'Ketik minimal 2 huruf untuk mencari.',
            'q.min' => 'Ketik minimal 2 huruf untuk mencari.',
            'q.max' => 'Kata pencarian maksimal 100 karakter.',
            'tipe.in' => 'Jenis pencarian tidak dikenal.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['q' => trim($this->string('q')->toString())]);
    }

    public function term(): string
    {
        return $this->string('q')->toString();
    }

    public function type(): ?string
    {
        return $this->filled('tipe') ? $this->string('tipe')->toString() : null;
    }
}
