<?php

namespace App\Http\Requests\Notes;

use Illuminate\Contracts\Validation\ValidationRule;

/** Rename (`title`) and/or move (`parent_id`, null = root). */
class UpdateNoteRequest extends NoteRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'nullable', 'string', 'max:200'],
            'parent_id' => ['sometimes', 'nullable', 'string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['title.max' => 'Judul catatan maksimal 200 karakter.'];
    }
}
