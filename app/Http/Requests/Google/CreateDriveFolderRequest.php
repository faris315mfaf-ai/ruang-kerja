<?php

namespace App\Http\Requests\Google;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Folder baru" in the File tab.
 */
class CreateDriveFolderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:250'],
            'parent' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{10,200}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama folder wajib diisi.',
            'name.max' => 'Nama folder maksimal 250 karakter.',
            'parent.regex' => 'Folder tidak valid.',
        ];
    }

    public function parent(): ?string
    {
        $parent = $this->input('parent');

        return is_string($parent) && $parent !== '' ? $parent : null;
    }
}
