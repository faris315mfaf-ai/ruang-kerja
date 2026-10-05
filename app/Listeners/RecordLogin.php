<?php

namespace App\Listeners;

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Runs for every successful sign-in (Google, password/TOTP, demo, remember-me):
 * remembers the method in the session, stamps `last_login_at` and audits Super
 * Admin sign-ins. The method comes from the controller/action declaration
 * (LoginMethod::declareFor); a remember-me restore is always "remember" (strict)
 * and an undeclared login counts as "password".
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

        $guard = Auth::guard($event->guard);
        $viaRemember = $guard instanceof SessionGuard && $guard->viaRemember();

        $method = LoginMethod::resolve(LoginMethod::declaredFor($this->request), $viaRemember);

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
