<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Notes\NoteRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/** GET /api/v1/catatan/{note}/mention?q=&limit= (404 first for unreadable notes). */
class NoteMentionRequest extends NoteRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.max' => 'Kata kunci maksimal 100 karakter.',
            'limit.max' => 'Maksimal 20 hasil.',
        ];
    }
}
