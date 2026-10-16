<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Notifications\PasswordSetByHrNotification;
use App\Domain\Auth\Services\DefaultPassword;
use App\Domain\Auth\Services\OpenPasswordResets;
use App\Domain\Auth\Services\SessionTerminator;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Admin › Karyawan › Atur kata sandi (UserPolicy::setPassword). HR gives the
 * company default password ("Sandi bawaan", EMPLOYEE_DEFAULT_PASSWORD; never
 * for a Super Admin) or types a new one. In one transaction: the password and
 * "wajib ganti saat login berikutnya" are saved, every existing sign-in of the
 * employee ends (the default password always with "wajib ganti"), open
 * "Lupa kata sandi" requests are closed and
 * `user.password_set_by_hr` is audited with the mode, never the value. The
 * employee is told in-app and by email (after commit).
 */
final readonly class SetEmployeePassword
{
    public function __construct(
        private AuditLogger $audit,
        private SessionTerminator $sessions,
        private OpenPasswordResets $openResets,
        private DefaultPassword $defaultPassword,
    ) {}

    /**
     * @param  string|null  $password  null = the company default password
     *
     * @throws LogicException when the default password is off or not allowed for this account
     */
    public function handle(User $actor, User $employee, #[\SensitiveParameter] ?string $password, bool $mustChange): void
    {
        $toDefault = $password === null;

        if ($toDefault && ! $this->defaultPassword->appliesTo($employee)) {
            throw new LogicException('The default password is off or not allowed for this account.');
        }

        // The default password is shared company-wide: an account may never keep
        // it without "wajib ganti" (audit rapat 2026-10, R-01).
        $mustChange = $mustChange || $toDefault;

        DB::transaction(function () use ($actor, $employee, $password, $mustChange, $toDefault): void {
            $employee->forceFill([
                'password' => $password ?? $this->defaultPassword->hash(),
                'password_change_required' => $mustChange,
            ]);
            $this->sessions->rotateRememberToken($employee);
            // One explicit audit row instead of a generic user.updated.
            $employee->saveQuietly();
            $this->sessions->deleteStoredSessions($employee);
            $this->sessions->revokeApiTokens($employee);

            // A pending "Lupa kata sandi" request is answered by this action.
            $this->openResets->cancelFor($employee);

            $this->audit->log('user.password_set_by_hr', $employee, null, [
                'mode' => $toDefault ? 'default' : 'manual',
                'must_change' => $mustChange,
            ], $actor);
        });

        $employee->notify(new PasswordSetByHrNotification($actor, $mustChange, toDefault: $toDefault));
    }
}
