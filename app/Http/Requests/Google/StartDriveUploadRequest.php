<?php

namespace App\Http\Requests\Google;

use App\Domain\Google\GoogleFeatures;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Opens a chunked upload: file name, size (≤ google.upload.max_bytes),
 * MIME type and the target sub-folder (File tab only).
 */
class StartDriveUploadRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1', 'max:'.GoogleFeatures::maxUploadBytes()],
            'mime_type' => ['nullable', 'string', 'max:255'],
            'folder' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{10,200}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $megabytes = intdiv(GoogleFeatures::maxUploadBytes(), 1024 * 1024);

        return [
            'name.required' => 'Nama file wajib ada.',
            'size.min' => 'File kosong tidak bisa diunggah.',
            'size.max' => "Ukuran file maksimal {$megabytes} MB.",
            'folder.regex' => 'Folder tidak valid.',
        ];
    }

    public function folder(): ?string
    {
        $folder = $this->input('folder');

        return is_string($folder) && $folder !== '' ? $folder : null;
    }
}
