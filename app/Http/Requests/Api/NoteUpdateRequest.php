<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Notes\NoteRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * PATCH /api/v1/catatan/{note} — the save fallback without collaboration,
 * for the app: `title` (web PATCH /catatan/{note}) and/or the whole document
 * as `body_html` (web PATCH /catatan/{note}/isi). A body_html save is based
 * on the `updated_at` the app last read; a save on an older version is
 * refused with 409 (SaveNoteContent), exactly like the web. Someone who may
 * not open the note gets 404 before validation (NoteRequest); the controller
 * still checks NotePolicy::update.
 */
class NoteUpdateRequest extends NoteRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'nullable', 'string', 'max:200', Rule::prohibitedIf($this->filled('body_html'))],
            'body_html' => ['sometimes', 'nullable', 'string', 'max:1000000'],
            'updated_at' => ['required_with:body_html', 'nullable', 'date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.max' => 'Judul catatan maksimal 200 karakter.',
            'title.prohibited' => 'Kirim title atau body_html, jangan keduanya.',
            'body_html.max' => 'Catatan terlalu panjang.',
            'updated_at.required_with' => 'Kirim updated_at dasar penyimpanan (dari GET /catatan/{note}).',
            'updated_at.date' => 'updated_at tidak valid.',
        ];
    }
}
