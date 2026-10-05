<?php

namespace App\Listeners;

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Http\Request;

/**
 * Runs for every successful sign-in (Google, password/TOTP, demo, remember-me):
 * remembers the method in the session, stamps `last_login_at` and audits Super
 * Admin sign-ins.
 */
final class RecordLogin
{
    public function __construct(
        private readonly Request $request,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Login $event): void
    {
        $user = $event->user;

        if (! $user instanceof User) {
            return;
        }

        $method = LoginMethod::fromRoute($this->request->route()?->getName(), $event->remember);

        if ($this->request->hasSession()) {
            $session = $this->request->session();

            $session->put(LoginMethod::SESSION_KEY, $method->value);

            // The password was just verified: no second prompt on the forced 2FA setup page.
            if ($method === LoginMethod::Password) {
                $session->passwordConfirmed();
            }
        }

        // last_login_at is excluded from the audit trail (User::auditExclude()).
        $user->forceFill(['last_login_at' => now()])->save();

        if ($user->isSuperAdmin()) {
            $this->audit->log('user.logged_in', $user, null, [
                'method' => $method->value,
            ], $user);
        }
    }
}
