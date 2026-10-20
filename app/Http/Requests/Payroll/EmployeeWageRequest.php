<?php

namespace App\Http\Requests\Payroll;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Absensi › Gaji: daily wage of one employee from a date on. Authorization:
 * PayrollPolicy::manageWages in the controller.
 */
class EmployeeWageRequest extends FormRequest
{
    public const int MAX_WAGE = 100_000_000;

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
            'daily_wage' => ['required', 'integer', 'min:0', 'max:'.self::MAX_WAGE],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'daily_wage.required' => 'Isi upah harian.',
            'daily_wage.integer' => 'Upah harian berupa angka rupiah tanpa koma.',
            'daily_wage.min' => 'Upah harian tidak boleh minus.',
            'daily_wage.max' => 'Upah harian maksimal Rp100.000.000.',
            'effective_from.required' => 'Isi tanggal mulai berlaku.',
            'effective_from.date_format' => 'Tanggal mulai berlaku tidak valid.',
        ];
    }
}
