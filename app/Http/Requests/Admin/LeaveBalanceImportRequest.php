<?php

namespace App\Http\Requests\Admin;

use App\Models\LeaveBalance;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class LeaveBalanceImportRequest extends FormRequest
{
    public const int MAX_KILOBYTES = 2048;

    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows('create', LeaveBalance::class);
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
            'mode' => ['required', 'in:preview,commit'],
        ];
    }

    public function commits(): bool
    {
        return $this->input('mode') === 'commit';
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Pilih berkas CSV atau XLSX.',
            'file.extensions' => 'Berkas impor harus berformat CSV atau XLSX.',
            'file.mimetypes' => 'Berkas impor harus berformat CSV atau XLSX.',
            'file.max' => 'Berkas impor maksimal 2 MB.',
        ];
    }
}
