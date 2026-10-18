<?php

namespace App\Http\Requests\Admin;

use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Rules\CompanyEmail;
use App\Domain\Organization\Rules\ValidManager;
use App\Domain\Organization\Services\RoleChangeGuard;
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
            'roles' => ['required', 'array', 'min:1', $this->roleChangeRule($actor, $employee)],
            'roles.*' => ['required', 'distinct', Rule::enum(Role::class), $this->grantRoleRule($actor, $employee)],
            'employee_number' => [
                'nullable', 'string', 'max:30',
                // Unique within the company (Fase 1 multi-perusahaan).
                Rule::unique('employee_profiles', 'employee_number')->where('company_id', $companyId)->ignore($employee?->id, 'user_id'),
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
     * Friendly validation error before UserPolicy::assignRole would answer 403:
     * only a Super Admin grants super_admin, direksi or hr.
     */
    private function grantRoleRule(User $actor, ?User $employee): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($actor, $employee): void {
            $role = is_string($value) ? Role::tryFrom($value) : null;

            if ($role === null || ! $role->onlySuperAdminAssigns() || $actor->isSuperAdmin()) {
                return;
            }

            if ($employee === null || ! in_array($role, RoleChangeGuard::rolesOf($employee), true)) {
                $fail("Hanya Super Admin yang dapat memberikan peran {$role->label()}.");
            }
        };
    }

    /**
     * Nobody changes their own roles; only a Super Admin revokes super_admin, direksi or hr.
     */
    private function roleChangeRule(User $actor, ?User $employee): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($actor, $employee): void {
            if ($employee === null || ! is_array($value)) {
                return;
            }

            $after = [];

            foreach ($value as $item) {
                $role = is_string($item) ? Role::tryFrom($item) : null;

                if ($role !== null) {
                    $after[] = $role;
                }
            }

            $before = RoleChangeGuard::rolesOf($employee);
            $changed = app(RoleChangeGuard::class)->changed($before, $after);

            if ($changed === []) {
                return;
            }

            if ($actor->is($employee)) {
                $fail('Anda tidak dapat mengubah peran Anda sendiri.');

                return;
            }

            if ($actor->isSuperAdmin()) {
                return;
            }

            foreach ($changed as $role) {
                if ($role->onlySuperAdminAssigns() && in_array($role, $before, true)) {
                    $fail("Hanya Super Admin yang dapat mencabut peran {$role->label()}.");

                    return;
                }
            }
        };
    }
}
