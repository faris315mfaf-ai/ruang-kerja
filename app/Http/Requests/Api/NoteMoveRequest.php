<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Notes\NoteRequest;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * PATCH /api/v1/catatan/{note}/pindah — move under another note/folder of
 * the same workspace (`parent_id`, null = root) and optionally to a 0-based
 * `position` among the siblings the user sees (reordering). Someone who may
 * not open the note gets 404 first (NoteRequest).
 */
class NoteMoveRequest extends NoteRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'parent_id' => ['present', 'nullable', 'string', 'ulid'],
            'position' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'parent_id.present' => 'Kirim parent_id (null untuk memindahkan ke tingkat atas).',
            'parent_id.ulid' => 'parent_id tidak valid.',
            'position.integer' => 'Posisi harus berupa angka.',
            'position.min' => 'Posisi tidak boleh negatif.',
        ];
    }
}
