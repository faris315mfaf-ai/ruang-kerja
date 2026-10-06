<?php

namespace App\Http\Requests\Automation;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/** "Simpan sebagai template" (Pengaturan workspace): template name and description. */
class SaveWorkspaceTemplateRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Beri nama template.',
            'name.max' => 'Nama maksimal 80 karakter.',
            'description.max' => 'Keterangan maksimal 255 karakter.',
        ];
    }

    /**
     * @return array{name: string, description: string|null}
     */
    public function payload(): array
    {
        $description = $this->input('description');

        return [
            'name' => $this->string('name')->trim()->toString(),
            'description' => is_string($description) ? $description : null,
        ];
    }
}
