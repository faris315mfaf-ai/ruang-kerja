<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Fortify;

/**
 * Checks the second factor of a mobile sign-in with Fortify's own pieces: a
 * current TOTP code (TwoFactorAuthenticationProvider — also remembers used
 * codes so one cannot be replayed) or one of the unused recovery codes, which
 * is consumed and replaced (User::replaceRecoveryCode), exactly like the web
 * challenge. A failure is audited like a failed password.
 */
final readonly class VerifyApiTwoFactor
{
    public function __construct(
        private TwoFactorAuthenticationProvider $provider,
        private AuditLogger $audit,
    ) {}

    public function handle(User $user, ?string $code, ?string $recoveryCode): bool
    {
        if (! $user->hasEnabledTwoFactorAuthentication()) {
            return false;
        }

        if ($this->validCode($user, $code)) {
            return true;
        }

        $recovery = $this->matchingRecoveryCode($user, $recoveryCode);

        if ($recovery !== null) {
            $user->replaceRecoveryCode($recovery);
            $this->audit->log('user.two_factor_recovery_code_used', $user, null, ['channel' => 'api'], $user);

            return true;
        }

        $this->audit->log('user.login_failed', $user, null, ['method' => 'password', 'reason' => 'two_factor_invalid', 'channel' => 'api']);

        return false;
    }

    private function validCode(User $user, ?string $code): bool
    {
        if ($code === null || $code === '' || $user->two_factor_secret === null) {
            return false;
        }

        return $this->provider->verify(Fortify::currentEncrypter()->decrypt($user->two_factor_secret), $code);
    }

    private function matchingRecoveryCode(User $user, ?string $recoveryCode): ?string
    {
        if ($recoveryCode === null || $recoveryCode === '' || $user->two_factor_recovery_codes === null) {
            return null;
        }

        foreach ($user->recoveryCodes() as $stored) {
            if (is_string($stored) && hash_equals($stored, $recoveryCode)) {
                return $stored;
            }
        }

        return null;
    }
}
