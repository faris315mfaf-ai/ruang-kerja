<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Password, password-confirmation and two-factor management routes (ours and
 * Fortify's) are for Super Admins only — every other employee signs in with
 * Google and has no password to manage. Registered in the `web` group because
 * Fortify's routes cannot take per-route middleware.
 */
class RestrictCredentialRoutes
{
    public const string MESSAGE = 'Pengaturan kata sandi dan 2FA hanya untuk Super Admin.';

    /**
     * @var list<string>
     */
    public const array ROUTES = [
        'security.edit',
        'user-password.update',
        'password.confirm',
        'password.confirm.store',
        'password.confirmation',
        'two-factor.enable',
        'two-factor.confirm',
        'two-factor.disable',
        'two-factor.qr-code',
        'two-factor.secret-key',
        'two-factor.recovery-codes',
        'two-factor.regenerate-recovery-codes',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User && $request->routeIs(...self::ROUTES)) {
            abort_unless(Gate::forUser($user)->allows('manageCredentials', $user), Response::HTTP_FORBIDDEN, self::MESSAGE);
        }

        return $next($request);
    }
}
