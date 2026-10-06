<?php

namespace App\Http\Presenters;

use App\Http\Requests\Admin\UpdateEmployeeRequest;
use App\Models\AuditLog;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Shapes employees for the Admin › Karyawan pages. NIK is never sent in clear:
 * only a masked form (last four digits) for people who manage employees.
 */
final class EmployeePresenter
{
    /**
     * @return array<string, mixed>
     */
    public static function row(User $employee, User $viewer): array
    {
        $gate = Gate::forUser($viewer);

        return [
            'id' => $employee->id,
            'name' => $employee->name,
            'email' => $employee->email,
            'avatar_url' => $employee->avatar_url,
            'division' => $employee->division?->only(['id', 'name', 'code']),
            'team' => $employee->team?->only(['id', 'name']),
            'position' => $employee->position?->only(['id', 'name']),
            'manager' => $employee->manager?->only(['id', 'name', 'avatar_url']),
            'work_mode' => $employee->work_mode->value,
            'roles' => $employee->getRoleNames()->values()->all(),
            'status' => $employee->status->value,
            'joined_at' => $employee->joined_at?->toDateString(),
            'can' => [
                'update' => $gate->allows('update', $employee),
                'deactivate' => $gate->allows('deactivate', $employee),
            ],
        ];
    }

    /**
     * Values for the edit form (requires `update`).
     *
     * @return array<string, mixed>
     */
    public static function form(User $employee, User $viewer): array
    {
        $employee->loadMissing(['profile', 'manager.position:id,name', 'roles:id,name']);
        $profile = $employee->profile;

        return [
            ...self::row($employee, $viewer),
            'division_id' => $employee->division_id,
            'team_id' => $employee->team_id,
            'position_id' => $employee->position_id,
            'manager_id' => $employee->manager_id,
            'manager' => $employee->manager === null ? null : self::managerOption($employee->manager),
            'email_locked' => UpdateEmployeeRequest::emailLocked($employee),
            'employee_number' => $profile?->employee_number,
            'phone' => $profile?->phone,
            'nik_masked' => self::maskNik($profile?->nik),
            'direct_reports_count' => $employee->directReports()->count(),
        ];
    }

    /**
     * @return array{id: string, name: string, avatar_url: string|null, position: string|null}
     */
    public static function managerOption(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url,
            'position' => $user->position?->name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function auditEntry(AuditLog $log): array
    {
        $new = $log->new_values ?? [];
        $old = $log->old_values ?? [];
        $fields = $log->action === 'employee_profile.updated'
            ? (is_array($new['fields'] ?? null) ? array_values($new['fields']) : [])
            : array_values(array_unique([...array_keys($old), ...array_keys($new)]));

        return [
            'id' => $log->id,
            'action' => $log->action,
            'actor' => $log->user?->name,
            'fields' => in_array($log->action, ['user.created'], true) ? [] : $fields,
            'reason' => is_string($new['reason'] ?? null) ? $new['reason'] : null,
            'created_at' => $log->created_at->toIso8601String(),
        ];
    }

    public static function maskNik(?string $nik): ?string
    {
        if ($nik === null || $nik === '') {
            return null;
        }

        return str_repeat('•', max(0, mb_strlen($nik) - 4)).mb_substr($nik, -4);
    }

    /**
     * A "Lupa kata sandi" request awaiting HR (Admin › Karyawan).
     *
     * @return array{id: string, employee: array{id: string|null, name: string, email: string, avatar_url: string|null}, requested_at: string, expires_at: string, ip: string|null}
     */
    public static function passwordReset(PasswordResetRequest $request): array
    {
        return [
            'id' => $request->id,
            'employee' => [
                'id' => $request->user_id,
                'name' => $request->user->name ?? $request->email,
                'email' => $request->email,
                'avatar_url' => $request->user?->avatar_url,
            ],
            'requested_at' => $request->created_at->toIso8601String(),
            'expires_at' => $request->expires_at->toIso8601String(),
            'ip' => $request->ip,
        ];
    }
}
