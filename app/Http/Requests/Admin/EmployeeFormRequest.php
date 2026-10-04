<?php

namespace App\Http\Requests\Admin;

use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Rules\CompanyEmail;
use App\Domain\Organization\Rules\ValidManager;
use App\Models\Company;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Shared rules of the Admin › Karyawan create/edit form.
 */
abstract class EmployeeFormRequest extends FormRequest
{
    /**
     * The employee being edited (null when creating).
     */
    abstract protected function employee(): ?User;

    protected function actor(): User
    {
        $user = $this->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');
        $nik = $this->input('nik');

        $this->merge([
            'email' => is_string($email) ? mb_strtolower(trim($email)) : $email,
            // NIK is often pasted with spaces or dots.
            'nik' => is_string($nik) ? preg_replace('/\D+/', '', $nik) : $nik,
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $actor = $this->actor();
        $employee = $this->employee();
        $companyId = $actor->company_id;
        $divisionId = $this->input('division_id');

        return [
            'name' => ['required', 'string', 'max:150'],
            'email' => [
                'required', 'string', 'email:rfc', 'max:190',
                // Fresh query: the shared Inertia props load `company` with id & name only.
                new CompanyEmail(Company::query()->findOrFail($companyId)),
                Rule::unique('users', 'email')->ignore($employee?->id),
            ],
            'division_id' => [
                'nullable', 'string',
                Rule::exists('divisions', 'id')->where('company_id', $companyId)->whereNull('deleted_at'),
            ],
            'team_id' => [
                'nullable', 'string',
                Rule::exists('teams', 'id')
                    ->where('division_id', is_string($divisionId) ? $divisionId : '')
                    ->whereNull('deleted_at'),
            ],
            'position_id' => [
                'nullable', 'string',
                Rule::exists('positions', 'id')->where('company_id', $companyId)->whereNull('deleted_at'),
            ],
            'manager_id' => ['nullable', 'string', new ValidManager($employee, $companyId)],
            'work_mode' => ['required', Rule::enum(WorkMode::class)],
            'joined_at' => ['nullable', 'date_format:Y-m-d'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['required', 'distinct', Rule::enum(Role::class), $this->superAdminRoleRule($actor)],
            'employee_number' => [
                'nullable', 'string', 'max:30',
                Rule::unique('employee_profiles', 'employee_number')->ignore($employee?->id, 'user_id'),
            ],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9][0-9 \-]{6,24}$/'],
            'nik' => ['nullable', 'string', 'digits:16'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama lengkap',
            'email' => 'email Google',
            'division_id' => 'divisi',
            'team_id' => 'tim',
            'position_id' => 'jabatan',
            'manager_id' => 'atasan langsung',
            'work_mode' => 'mode kerja',
            'joined_at' => 'tanggal bergabung',
            'roles' => 'peran',
            'roles.*' => 'peran',
            'employee_number' => 'nomor karyawan',
            'phone' => 'nomor telepon',
            'nik' => 'NIK',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'team_id.exists' => 'Tim harus berada di divisi yang dipilih.',
            'roles.required' => 'Pilih minimal satu peran.',
            'roles.min' => 'Pilih minimal satu peran.',
            'phone.regex' => 'Nomor telepon hanya boleh berisi angka, spasi, tanda hubung, dan awalan +.',
        ];
    }

    public function employeeData(): EmployeeData
    {
        return EmployeeData::fromValidated($this->validated());
    }

    /**
     * Friendly validation error before UserPolicy::assignRole would answer 403.
     */
    private function superAdminRoleRule(User $actor): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($actor): void {
            if ($value === Role::SuperAdmin->value && ! $actor->isSuperAdmin()) {
                $fail('Hanya Super Admin yang dapat memberikan peran Super Admin.');
            }
        };
    }
}
