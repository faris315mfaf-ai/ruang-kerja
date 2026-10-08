<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Notifications\PasswordSetByHrNotification;
use App\Domain\Auth\Services\DefaultPassword;
use App\Domain\Auth\Services\OpenPasswordResets;
use App\Domain\Auth\Services\SessionTerminator;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * `php artisan ruangkerja:reset-default-passwords` (owner decision 7 Oct 2026):
 * returns employee accounts to the company default password with "wajib ganti
 * saat login berikutnya". Eligible: every account without a
 * super_admin/direksi/hr role (audit R-06) that is active or inactive (an
 * inactive one may be reactivated later); resigned accounts are skipped. Per
 * account: remember token rotated, stored sessions deleted (the new hash also
 * ends AuthenticateSession sessions), open "Lupa kata sandi" requests closed
 * and one `user.password_reset_to_default` audit row (never the value).
 * Chunked, one transaction per chunk; notifications (in-app + email) only on
 * request, after each chunk commits.
 */
final readonly class ResetPasswordsToDefault
{
    public const int CHUNK = 100;

    public function __construct(
        private DefaultPassword $defaultPassword,
        private SessionTerminator $sessions,
        private OpenPasswordResets $openResets,
        private AuditLogger $audit,
    ) {}

    /**
     * @return Builder<User>
     */
    public function eligible(bool $onlyWithoutPassword = false): Builder
    {
        return User::query()
            ->whereIn('status', [UserStatus::Active->value, UserStatus::Inactive->value])
            // R-06: super_admin/direksi/hr passwords are Super Admin only,
            // never the shared default.
            ->whereDoesntHave('roles', fn (Builder $roles) => $roles->whereIn('name', array_map(
                fn (Role $role): string => $role->value,
                Role::superAdminSetsPassword(),
            )))
            ->when($onlyWithoutPassword, fn (Builder $query) => $query->whereNull('password'));
    }

    /**
     * @param  (callable(int): void)|null  $progress  called with the size of each committed chunk
     * @return int number of accounts reset
     *
     * @throws LogicException when EMPLOYEE_DEFAULT_PASSWORD is empty
     */
    public function handle(bool $onlyWithoutPassword = false, bool $notify = false, ?callable $progress = null): int
    {
        if (! $this->defaultPassword->enabled()) {
            throw new LogicException('EMPLOYEE_DEFAULT_PASSWORD is not configured.');
        }

        $hash = $this->defaultPassword->hash();
        $total = 0;

        $this->eligible($onlyWithoutPassword)->chunkById(self::CHUNK, function (Collection $users) use ($hash, $notify, $progress, &$total): void {
            DB::transaction(function () use ($users, $hash): void {
                foreach ($users as $user) {
                    /** @var User $user */
                    $wasEmpty = $user->password === null;

                    $user->forceFill([
                        'password' => $hash,
                        'password_change_required' => true,
                    ]);
                    $this->sessions->rotateRememberToken($user);
                    // One explicit audit row instead of a generic user.updated.
                    $user->saveQuietly();
                    $this->sessions->deleteStoredSessions($user);
                    $this->openResets->cancelFor($user);

                    $this->audit->log('user.password_reset_to_default', $user, null, [
                        // Key without "password": AuditLogger masks those.
                        'was_empty' => $wasEmpty,
                        'must_change' => true,
                    ]);
                }
            });

            if ($notify) {
                foreach ($users as $user) {
                    /** @var User $user */
                    $user->notify(new PasswordSetByHrNotification(null, mustChange: true, toDefault: true));
                }
            }

            $total += $users->count();

            if ($progress !== null) {
                $progress($users->count());
            }
        });

        return $total;
    }
}
