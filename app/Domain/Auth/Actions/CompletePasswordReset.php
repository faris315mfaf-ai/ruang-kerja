<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Enums\PasswordResetStatus;
use App\Domain\Auth\Services\SessionTerminator;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Lupa kata sandi" › Sandi baru: the browser holding the setup token (issued
 * after HR approval, 30 minutes) saves the new password. The request becomes
 * `used` (the token is single-use), every existing sign-in of the employee is
 * ended, "wajib ganti" is cleared and `user.password_reset_completed` is
 * audited (never the value). The controller then signs this browser in.
 */
final readonly class CompletePasswordReset
{
    public const string INVALID = 'Tautan pengaturan kata sandi sudah tidak berlaku. Ajukan permintaan baru.';

    public function __construct(
        private AuditLogger $audit,
        private SessionTerminator $sessions,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(PasswordResetRequest $request, #[\SensitiveParameter] string $password): User
    {
        return DB::transaction(function () use ($request, $password): User {
            $locked = PasswordResetRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            $user = $locked->user_id === null ? null : User::query()->whereKey($locked->user_id)->lockForUpdate()->first();

            if (! $locked->canBeCompleted() || $user === null || ! $user->isActive()) {
                throw ValidationException::withMessages(['password' => self::INVALID]);
            }

            $user->forceFill([
                'password' => $password,
                'password_change_required' => false,
            ]);
            $this->sessions->rotateRememberToken($user);
            // One explicit audit row instead of a generic user.updated.
            $user->saveQuietly();
            $this->sessions->deleteStoredSessions($user);

            $locked->forceFill(['status' => PasswordResetStatus::Used, 'setup_token_hash' => null])->save();

            $this->audit->log('user.password_reset_completed', $user, null, [
                'request_id' => $locked->id,
            ], $user);

            return $user;
        });
    }
}
