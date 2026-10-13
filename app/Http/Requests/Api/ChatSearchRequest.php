<?php

namespace App\Http\Requests\Api;

use App\Domain\Chat\Queries\MessageSearch;
use App\Http\Requests\Chat\ChatRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** GET /api/v1/obrolan/{channel}/cari?q=&sebelum= */
class ChatSearchRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:'.MessageSearch::MIN_LENGTH, 'max:100'],
            'sebelum' => ['sometimes', 'nullable', 'string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.required' => 'Ketik kata yang dicari.',
            'q.min' => 'Ketik minimal '.MessageSearch::MIN_LENGTH.' karakter.',
            'q.max' => 'Kata pencarian maksimal 100 karakter.',
        ];
    }
}
