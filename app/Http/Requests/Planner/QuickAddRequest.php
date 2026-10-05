<?php

namespace App\Http\Requests\Planner;

use App\Domain\Planner\Enums\PlanBucket;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /ruang-saya/catatan — "Tambah catatan pribadi" (title, optional lane).
 */
class QuickAddRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:255'],
            'bucket' => ['nullable', 'string', Rule::enum(PlanBucket::class)],
        ];
    }

    public function bucket(): PlanBucket
    {
        return $this->filled('bucket') ? PlanBucket::from($this->string('bucket')->toString()) : PlanBucket::Today;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Tulis catatannya dulu.',
            'title.max' => 'Catatan maksimal 255 karakter.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['title' => trim($this->string('title')->toString())]);
    }
}
