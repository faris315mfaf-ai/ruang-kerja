<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/workspace/{workspace}/catatan — "Catatan baru" of the mobile
 * app: an empty note with a title (web CreateNote). Authorization
 * (NotePolicy::create) is the controller's job; the {workspace} binder
 * already answered 404 for workspaces the caller may not see.
 */
class WorkspaceNoteStoreRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
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
        ];
    }
}
