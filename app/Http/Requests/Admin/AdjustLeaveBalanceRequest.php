<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AdjustLeaveBalanceRequest extends FormRequest
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
            'delta_days' => ['required', 'numeric', 'not_in:0', 'min:-365', 'max:365', 'multiple_of:0.5'],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'delta_days.required' => 'Isi jumlah hari (+ menambah, − mengurangi).',
            'delta_days.not_in' => 'Penyesuaian tidak boleh 0.',
            'delta_days.numeric' => 'Harus berupa angka.',
            'delta_days.min' => 'Maksimal ±365 hari.',
            'delta_days.max' => 'Maksimal ±365 hari.',
            'delta_days.multiple_of' => 'Kelipatan 0,5 hari.',
            'reason.required' => 'Alasan penyesuaian wajib diisi.',
            'reason.max' => 'Alasan maksimal 255 karakter.',
        ];
    }
}
