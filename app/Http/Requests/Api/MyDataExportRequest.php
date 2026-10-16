<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * GET /api/v1/privasi/ekspor?format=xlsx|pdf
 */
class MyDataExportRequest extends FormRequest
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
            'format' => ['required', 'string', 'in:xlsx,pdf'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'format.required' => 'Format unduhan wajib dipilih (xlsx atau pdf).',
            'format.in' => 'Format unduhan harus xlsx atau pdf.',
        ];
    }

    /**
     * @return 'xlsx'|'pdf'
     */
    public function exportFormat(): string
    {
        return $this->string('format')->toString() === 'pdf' ? 'pdf' : 'xlsx';
    }
}
