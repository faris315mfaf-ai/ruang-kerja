<?php

namespace App\Http\Requests\Search;

use App\Domain\Search\Services\SearchRegistry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SearchRequest extends FormRequest
{
    /**
     * Every signed-in employee may search; providers filter by visibility.
     */
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
            'q' => ['nullable', 'string', 'max:100'],
            'group' => ['nullable', 'string', Rule::in(app(SearchRegistry::class)->keys())],
        ];
    }

    public function term(): string
    {
        return trim($this->string('q')->toString());
    }

    public function group(): ?string
    {
        return $this->filled('group') ? $this->string('group')->toString() : null;
    }
}
