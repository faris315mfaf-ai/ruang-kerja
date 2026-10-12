<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Mobile API counterpart of EnsurePasswordChanged and
 * EnsureTwoFactorForSuperAdmin (web only). A token issued before HR set a
 * temporary password, or before the account became a Super Admin, must not
 * keep working: every API call answers 403 with the same machine-readable
 * `code` the login uses (`password_change_required` / `two_factor_setup_required`),
 * so the app shows the message — or runs the forced password change itself —
 * and returns to the login screen. Only ALLOWED_ROUTES stay reachable: logout,
 * the profile (to read the flags) and the own-password change.
 *
 * Super Admins may use the app once their TOTP is confirmed (owner decision
 * 13 Oct 2026, POST /auth/dua-faktor); one without confirmed TOTP is blocked
 * until they enable it on the web.
 */
class EnsureApiAccountUsable
{
    /**
     * @var list<string>
     */
    public const array ALLOWED_ROUTES = [
        'api.v1.auth.logout',
        'api.v1.auth.saya',
        'api.v1.auth.password',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || $request->routeIs(...self::ALLOWED_ROUTES)) {
            return $next($request);
        }

        if ($user->password_change_required) {
            return response()->json([
                'code' => 'password_change_required',
                'message' => 'Ganti kata sandi Anda terlebih dahulu untuk melanjutkan.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($user->isSuperAdmin() && ! $user->hasEnabledTwoFactorAuthentication()) {
            return response()->json([
                'code' => 'two_factor_setup_required',
                'message' => 'Aktifkan autentikasi dua faktor (TOTP) lewat web terlebih dahulu, lalu masuk lagi di aplikasi.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
