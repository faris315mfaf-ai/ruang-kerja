<?php

namespace App\Listeners;

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Services\AuditLogger;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

/**
 * Audits a wrong TOTP / recovery code during a Super Admin password sign-in.
 */
final class RecordFailedTwoFactor
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(TwoFactorAuthenticationFailed $event): void
    {
        $user = $event->user;

        if (! $user->isSuperAdmin()) {
            return;
        }

        $this->audit->log('user.login_failed', $user, null, [
            'method' => LoginMethod::Password->value,
            'reason' => 'two_factor_invalid',
        ]);
    }
}
