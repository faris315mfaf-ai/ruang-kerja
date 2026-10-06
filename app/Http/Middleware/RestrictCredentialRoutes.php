<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Credential routes (ours and Fortify's). Registered in the `web` group because
 * Fortify's routes cannot take per-route middleware.
 *
 * - Own password (Pengaturan › Keamanan): every active employee
 *   (UserPolicy::manageCredentials; owner decision 6 Oct 2026).
 * - Password confirmation and two-factor management: Super Admin only
 *   (UserPolicy::manageTwoFactor) — TOTP exists only for them.
 */
class RestrictCredentialRoutes
{
    public const string MESSAGE = 'Autentikasi dua faktor hanya untuk Super Admin.';

    /**
     * @var list<string>
     */
    public const array PASSWORD_ROUTES = [
        'security.edit',
        'user-password.update',
    ];

    /**
     * @var list<string>
     */
    public const array TWO_FACTOR_ROUTES = [
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

        if (! $user instanceof User) {
            return $next($request);
        }

        if ($request->routeIs(...self::PASSWORD_ROUTES)) {
            abort_unless(Gate::forUser($user)->allows('manageCredentials', $user), Response::HTTP_FORBIDDEN);
        } elseif ($request->routeIs(...self::TWO_FACTOR_ROUTES)) {
            abort_unless(Gate::forUser($user)->allows('manageTwoFactor', $user), Response::HTTP_FORBIDDEN, self::MESSAGE);
        }

        return $next($request);
    }
}
