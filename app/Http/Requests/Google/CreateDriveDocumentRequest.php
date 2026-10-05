<?php

namespace App\Http\Requests\Google;

use App\Domain\Google\Enums\GoogleDocType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Dokumen baru": type (Docs/Sheets/Slides), optional name and sub-folder.
 */
class CreateDriveDocumentRequest extends FormRequest
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
            'type' => ['required', Rule::enum(GoogleDocType::class)],
            'name' => ['nullable', 'string', 'max:250'],
            'folder' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{10,200}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Pilih jenis dokumen.',
            'type.enum' => 'Jenis dokumen tidak valid.',
            'name.max' => 'Nama dokumen maksimal 250 karakter.',
            'folder.regex' => 'Folder tidak valid.',
        ];
    }

    public function type(): GoogleDocType
    {
        return GoogleDocType::from($this->string('type')->toString());
    }

    public function folder(): ?string
    {
        $folder = $this->input('folder');

        return is_string($folder) && $folder !== '' ? $folder : null;
    }
}
