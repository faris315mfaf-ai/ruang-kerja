<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Chat\ChatRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** GET /api/v1/obrolan/{channel}/pesan/{message}/balasan?setelah=&per_page= */
class ChatRepliesRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'setelah' => ['sometimes', 'nullable', 'string', 'ulid'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }
}
