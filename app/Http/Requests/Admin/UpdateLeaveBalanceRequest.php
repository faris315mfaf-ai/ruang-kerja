<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLeaveBalanceRequest extends FormRequest
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
            'entitled_days' => ['required', 'numeric', 'min:0', 'max:365', 'multiple_of:0.5'],
            'carried_over_days' => ['required', 'numeric', 'min:0', 'max:365', 'multiple_of:0.5'],
            // Optional for backwards compatibility: missing = unchanged.
            'opening_days' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:365', 'multiple_of:0.5'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            '*.required' => 'Wajib diisi.',
            '*.numeric' => 'Harus berupa angka.',
            '*.min' => 'Tidak boleh negatif.',
            '*.multiple_of' => 'Kelipatan 0,5 hari.',
        ];
    }
}
