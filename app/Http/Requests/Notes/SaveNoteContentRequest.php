<?php

namespace App\Http\Requests\Notes;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Save fallback without collaboration: the whole Tiptap document (`body`,
 * never trimmed, see bootstrap/app.php) and the `updated_at` it was based on.
 */
class SaveNoteContentRequest extends NoteRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['present', 'nullable', 'array'],
            'updated_at' => ['required', 'date'],
        ];
    }
}
