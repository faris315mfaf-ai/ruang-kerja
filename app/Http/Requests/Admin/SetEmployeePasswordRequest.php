<?php

namespace App\Http\Requests\Admin;

use App\Concerns\PasswordValidationRules;
use App\Domain\Auth\Services\DefaultPassword;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Admin › Karyawan › Atur kata sandi: `mode` default (the company default
 * password, only while EMPLOYEE_DEFAULT_PASSWORD is set and never for a
 * super_admin/direksi/hr account, audit R-06) or manual (HR types it twice).
 * The former random generator was removed (owner decision 7 Oct 2026).
 */
class SetEmployeePasswordRequest extends FormRequest
{
    use PasswordValidationRules;

    public function authorize(): bool
    {
        $employee = $this->route('employee');

        return $employee instanceof User && Gate::forUser($this->user())->allows('setPassword', $employee);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $employee = $this->employee();
        $modes = ['manual'];

        if ($employee !== null && app(DefaultPassword::class)->appliesTo($employee)) {
            $modes[] = 'default';
        }

        $rules = [
            'mode' => ['required', 'in:'.implode(',', $modes)],
            'must_change' => ['required', 'boolean'],
        ];

        if ($this->input('mode') === 'manual') {
            $rules['password'] = $this->passwordRules($employee);
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'mode' => 'cara',
            'password' => 'kata sandi',
            'must_change' => 'wajib ganti',
        ];
    }

    /**
     * The typed password, or null for the default password.
     */
    public function password(): ?string
    {
        return $this->input('mode') === 'manual' ? $this->string('password')->toString() : null;
    }

    private function employee(): ?User
    {
        $employee = $this->route('employee');

        return $employee instanceof User ? $employee : null;
    }
}
