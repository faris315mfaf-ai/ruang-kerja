<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/** GET /api/v1/catatan/cari?q=&workspace_id=&limit= */
class NoteSearchRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:2', 'max:100'],
            'workspace_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.required' => 'Kata kunci pencarian wajib diisi.',
            'q.min' => 'Kata kunci minimal 2 karakter.',
            'q.max' => 'Kata kunci maksimal 100 karakter.',
            'workspace_id.ulid' => 'workspace_id tidak valid.',
            'limit.max' => 'Maksimal 50 hasil.',
        ];
    }
}
