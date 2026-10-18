<?php

namespace App\Domain\Organization\Services;

use App\Domain\Organization\Data\EmployeeData;
use App\Models\EmployeeProfile;
use App\Models\User;

/**
 * Writes the personal part of an employee (employee_profiles). Only the NAMES of
 * changed fields are audited (`employee_profile.updated`), never their values:
 * NIK and phone numbers must not spread into audit_logs (CORE decision 9).
 */
final readonly class EmployeeProfileWriter
{
    public function __construct(private AuditLogger $audit) {}

    public function write(User $employee, EmployeeData $data, ?User $actor = null): void
    {
        $profile = EmployeeProfile::query()->find($employee->id) ?? new EmployeeProfile(['user_id' => $employee->id]);
        $profile->company_id = $employee->company_id;

        $profile->employee_number = $data->employeeNumber;
        $profile->phone = $data->phone;

        if ($data->nik !== null) {
            $profile->nik = $data->nik;
        }

        if (! $profile->exists && $data->employeeNumber === null && $data->phone === null && $data->nik === null) {
            return;
        }

        // Eloquent compares encrypted casts by their decrypted value, so an unchanged NIK is not dirty.
        $changed = array_values(array_diff(array_keys($profile->getDirty()), ['user_id', 'created_at', 'updated_at']));

        $profile->save();

        if ($changed !== []) {
            $this->audit->log('employee_profile.updated', $employee, null, ['fields' => $changed], $actor);
        }
    }
}
