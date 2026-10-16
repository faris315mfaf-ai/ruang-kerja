<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Chat\ChatRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** PATCH /api/v1/obrolan/{channel}/pesan/{message} — edit the text of an own message. */
class ChatMessageUpdateRequest extends ChatRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:20000'],
            'mentions' => ['sometimes', 'array', 'max:20'],
            'mentions.*' => ['string', 'ulid'],
            'task_refs' => ['sometimes', 'array', 'max:20'],
            'task_refs.*' => ['string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required' => 'Pesan tidak boleh kosong. Hapus pesan bila tidak diperlukan lagi.',
            'body.max' => 'Pesan maksimal 20.000 karakter.',
        ];
    }
}
