<?php

namespace App\Http\Requests\Admin;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Admin › Karyawan › Atur kata sandi: `mode` manual (HR types it twice) or
 * generate (the app creates a temporary password shown once).
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
        $employee = $this->route('employee');

        $rules = [
            'mode' => ['required', 'in:manual,generate'],
            'must_change' => ['required', 'boolean'],
        ];

        if ($this->input('mode') === 'manual') {
            $rules['password'] = $this->passwordRules($employee instanceof User ? $employee->email : null);
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
     * The typed password, or null to generate one.
     */
    public function password(): ?string
    {
        return $this->input('mode') === 'manual' ? $this->string('password')->toString() : null;
    }
}
