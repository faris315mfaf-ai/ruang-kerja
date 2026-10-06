<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Notifications\PasswordSetByHrNotification;
use App\Domain\Auth\Services\SessionTerminator;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Admin › Karyawan › Atur kata sandi (UserPolicy::setPassword). HR types a new
 * password or lets the app generate a temporary one (returned once to show in
 * the dialog, never stored in plain text or logged). In one transaction:
 * the password and "wajib ganti saat login berikutnya" are saved, every
 * existing sign-in of the employee ends, open "Lupa kata sandi" requests are
 * closed and `user.password_set_by_hr` is audited without the value. The
 * employee is told in-app and by email (after commit).
 */
final readonly class SetEmployeePassword
{
    /** No look-alike characters (0/O, 1/l/I): read out loud or copied by hand. */
    private const string ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

    public function __construct(
        private AuditLogger $audit,
        private SessionTerminator $sessions,
        private ResolveNotificationsForSubject $resolveNotifications,
    ) {}

    /**
     * @param  string|null  $password  null = generate a temporary password
     * @return string the password that was set
     */
    public function handle(User $actor, User $employee, #[\SensitiveParameter] ?string $password, bool $mustChange): string
    {
        $generated = $password === null;
        $password ??= self::generate();

        DB::transaction(function () use ($actor, $employee, $password, $mustChange, $generated): void {
            $employee->forceFill([
                'password' => $password,
                'password_change_required' => $mustChange,
            ]);
            $this->sessions->rotateRememberToken($employee);
            // One explicit audit row instead of a generic user.updated.
            $employee->saveQuietly();
            $this->sessions->deleteStoredSessions($employee);

            // A pending "Lupa kata sandi" request is answered by this action.
            $open = PasswordResetRequest::query()
                ->where('user_id', $employee->id)
                ->whereIn('status', [PasswordResetStatus::Pending->value, PasswordResetStatus::Approved->value])
                ->get();

            foreach ($open as $request) {
                $request->forceFill(['status' => PasswordResetStatus::Canceled, 'setup_token_hash' => null])->save();
                $this->resolveNotifications->handle($request, NotificationType::PasswordResetRequested);
            }

            $this->audit->log('user.password_set_by_hr', $employee, null, [
                'generated' => $generated,
                'must_change' => $mustChange,
            ], $actor);
        });

        $employee->notify(new PasswordSetByHrNotification($actor, $mustChange));

        return $password;
    }

    /**
     * 12 characters in three groups, e.g. "Kp7m-Tq4z-Hn2w" (≈ 68 bits).
     */
    private static function generate(): string
    {
        $max = strlen(self::ALPHABET) - 1;
        $groups = [];

        for ($group = 0; $group < 3; $group++) {
            $chars = '';

            for ($i = 0; $i < 4; $i++) {
                $chars .= self::ALPHABET[random_int(0, $max)];
            }

            $groups[] = $chars;
        }

        return implode('-', $groups);
    }
}
