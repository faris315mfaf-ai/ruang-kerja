<?php

namespace App\Http\Requests\Payroll;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Absensi › Gaji › Aturan. Authorization: PayrollPolicy::manage in the controller.
 */
class PayrollRulesRequest extends FormRequest
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
            'pay_leave' => ['required', 'boolean'],
            'pay_sick' => ['required', 'boolean'],
            'pay_permit' => ['required', 'boolean'],
            'late_deduction' => ['required', 'integer', 'min:0', 'max:'.EmployeeWageRequest::MAX_WAGE],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'late_deduction.integer' => 'Potongan terlambat berupa angka rupiah tanpa koma.',
            'late_deduction.min' => 'Potongan terlambat tidak boleh minus.',
        ];
    }

    /**
     * @return array{pay_leave: bool, pay_sick: bool, pay_permit: bool, late_deduction: int}
     */
    public function payrollRules(): array
    {
        return [
            'pay_leave' => $this->boolean('pay_leave'),
            'pay_sick' => $this->boolean('pay_sick'),
            'pay_permit' => $this->boolean('pay_permit'),
            'late_deduction' => $this->integer('late_deduction'),
        ];
    }
}
