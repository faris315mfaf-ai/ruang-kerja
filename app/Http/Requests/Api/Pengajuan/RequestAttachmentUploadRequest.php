<?php

namespace App\Http\Requests\Api\Pengajuan;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

/**
 * POST /pengajuan/{id}/lampiran (multipart): `attachments[]` — or a single
 * `file` — with the web form's limits (config/requests.php: PDF/JPG/PNG,
 * 5 MB each, at most 5 per request; the total is checked by the action).
 */
final class RequestAttachmentUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $single = $this->file('file');

        if ($single instanceof UploadedFile && $this->file('attachments') === null) {
            // Request::allFiles() is cached by now, so the alias goes into the input.
            $this->merge(['attachments' => [$single]]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $attachments = config()->array('requests.attachments');

        return [
            'attachments' => ['required', 'array', 'min:1', 'max:'.(int) ($attachments['max_files'] ?? 5)],
            'attachments.*' => ['file', 'mimes:'.implode(',', (array) ($attachments['mimes'] ?? ['pdf'])), 'max:'.(int) ($attachments['max_kilobytes'] ?? 5120)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'attachments.required' => 'Pilih berkas yang akan dilampirkan.',
            'attachments.max' => 'Maksimal :max lampiran.',
            'attachments.*.file' => 'Lampiran harus berupa berkas.',
            'attachments.*.mimes' => 'Lampiran harus PDF, JPG, atau PNG.',
            'attachments.*.max' => 'Ukuran lampiran maksimal 5 MB.',
        ];
    }

    /**
     * @return list<UploadedFile>
     */
    public function attachmentFiles(): array
    {
        $files = [];

        $validated = $this->validated('attachments', []);

        foreach (is_array($validated) ? $validated : [] as $file) {
            if ($file instanceof UploadedFile) {
                $files[] = $file;
            }
        }

        return $files;
    }
}
