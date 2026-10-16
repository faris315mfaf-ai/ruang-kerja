<?php

namespace App\Http\Requests\Api;

use App\Domain\Notes\Enums\NoteKind;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/catatan — new note, folder, tab or sub-page. `workspace_id`
 * names the workspace; it may be left out when `parent_id` is sent (a tab
 * or sub-page): the workspace is then the parent's. Authorization
 * (NotePolicy::create) and the tree rules (a folder only at the root or in
 * a folder) are the controller's / CreateNote's job.
 */
class NoteCreateRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'workspace_id' => ['required_without:parent_id', 'nullable', 'string', 'ulid'],
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
            'workspace_id.required_without' => 'Pilih workspace catatan atau kirim parent_id.',
            'workspace_id.ulid' => 'workspace_id tidak valid.',
            'parent_id.ulid' => 'parent_id tidak valid.',
            'kind.enum' => 'Jenis harus note atau folder.',
        ];
    }
}
