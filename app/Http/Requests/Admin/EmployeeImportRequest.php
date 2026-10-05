<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class EmployeeImportRequest extends FormRequest
{
    public const int MAX_KILOBYTES = 5120;

    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows('manage', User::class);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required', 'file', 'max:'.self::MAX_KILOBYTES,
                'extensions:csv,xlsx',
                'mimetypes:text/csv,text/plain,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/octet-stream',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['file' => 'berkas impor'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.extensions' => 'Berkas impor harus berformat CSV atau XLSX.',
            'file.mimetypes' => 'Berkas impor harus berformat CSV atau XLSX.',
            'file.max' => 'Berkas impor maksimal 5 MB.',
        ];
    }
}
