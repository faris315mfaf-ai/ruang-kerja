<?php

namespace App\Http\Requests\Google;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Files picked with Google Picker (ids only; metadata is fetched server-side).
 */
class LinkDriveFilesRequest extends FormRequest
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
            'file_ids' => ['required', 'array', 'min:1', 'max:20'],
            'file_ids.*' => ['required', 'string', 'distinct', 'regex:/^[A-Za-z0-9_-]{10,200}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file_ids.required' => 'Pilih minimal satu file.',
            'file_ids.max' => 'Maksimal 20 file sekaligus.',
            'file_ids.*.regex' => 'File Drive tidak valid.',
        ];
    }

    /**
     * @return list<string>
     */
    public function fileIds(): array
    {
        /** @var list<string> $ids */
        $ids = array_values(array_filter((array) $this->input('file_ids', []), 'is_string'));

        return $ids;
    }
}
