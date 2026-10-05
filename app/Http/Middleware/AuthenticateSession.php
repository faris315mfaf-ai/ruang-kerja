<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\AuthenticateSession as BaseAuthenticateSession;
use Symfony\Component\HttpFoundation\Response;

/**
 * Laravel's AuthenticateSession (a password change signs out other devices),
 * with the stored password hash bound to the account it was taken from. A
 * session that is now authenticated as another account (e.g. tests switching
 * users with actingAs(), or any login that kept the session data) starts with
 * a fresh hash instead of being logged out. Other devices of the SAME account
 * are still signed out after a password change.
 */
class AuthenticateSession extends BaseAuthenticateSession
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle($request, Closure $next)
    {
        $user = $request->hasSession() ? $request->user() : null;

        if ($user !== null) {
            $guard = $this->auth->getDefaultDriver();
            $ownerKey = "password_hash_user_{$guard}";
            $owner = $user->getAuthIdentifier();

            if ($request->session()->get($ownerKey) !== $owner) {
                $request->session()->forget("password_hash_{$guard}");
                $request->session()->put($ownerKey, $owner);
            }
        }

        return parent::handle($request, $next);
    }
}
