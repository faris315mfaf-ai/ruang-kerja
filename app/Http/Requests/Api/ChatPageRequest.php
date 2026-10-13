<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Chat\ChatRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** Paged lists of Obrolan (members, public channels): ?page=&per_page=&q=. */
class ChatPageRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }
}
