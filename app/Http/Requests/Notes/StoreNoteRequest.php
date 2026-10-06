<?php

namespace App\Http\Requests\Notes;

use App\Domain\Notes\Enums\NoteKind;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/** "Catatan baru": title, workspace, optional parent note. */
class StoreNoteRequest extends NoteRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'workspace_id' => ['required', 'string', 'ulid'],
            'parent_id' => ['nullable', 'string', 'ulid'],
            'kind' => ['sometimes', Rule::enum(NoteKind::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul wajib diisi.',
            'title.max' => 'Judul maksimal 200 karakter.',
            'workspace_id.required' => 'Pilih workspace catatan.',
        ];
    }
}
