<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

class UpdateEmployeeRequest extends EmployeeFormRequest
{
    public function authorize(): bool
    {
        return Gate::forUser($this->actor())->allows('update', $this->employee());
    }

    protected function employee(): User
    {
        $employee = $this->route('employee');
        abort_unless($employee instanceof User, 404);

        return $employee;
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $employee = $this->employee();

                if ($this->input('email') !== $employee->email && self::emailLocked($employee)) {
                    $validator->errors()->add('email', 'Email tidak bisa diubah karena karyawan sudah pernah masuk dengan akun Google ini.');
                }
            },
        ];
    }

    /**
     * Once an employee has signed in, their email is bound to their Google account.
     */
    public static function emailLocked(User $employee): bool
    {
        return $employee->google_id !== null || $employee->last_login_at !== null;
    }
}
