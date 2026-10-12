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
 * `code` the login uses (`password_change_required` / `two_factor_required`),
 * so the app shows the message and returns to the login screen. Only logout
 * stays reachable. Super Admins never use the app (TOTP is not supported
 * there yet), mirroring the API login.
 */
class EnsureApiAccountUsable
{
    /**
     * @var list<string>
     */
    public const array ALLOWED_ROUTES = [
        'api.v1.auth.logout',
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
                'message' => 'Ganti kata sandi lewat web terlebih dahulu.',
            ], Response::HTTP_FORBIDDEN);
        }

        if ($user->isSuperAdmin()) {
            return response()->json([
                'code' => 'two_factor_required',
                'message' => 'Akun Super Admin harus masuk lewat web untuk saat ini (autentikasi dua faktor belum didukung aplikasi).',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
