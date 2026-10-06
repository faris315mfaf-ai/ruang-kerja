<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * HR set a temporary password with "wajib ganti saat login berikutnya"
 * (users.password_change_required): every page redirects to Pengaturan ›
 * Keamanan until the employee chooses their own password. Only that page,
 * the password update, logout and theme stay reachable.
 */
class EnsurePasswordChanged
{
    public const string MESSAGE = 'Ganti kata sandi sementara dari HR dengan kata sandi Anda sendiri untuk melanjutkan.';

    /**
     * @var list<string>
     */
    public const array ALLOWED_ROUTES = [
        'security.edit',
        'user-password.update',
        // A Super Admin may also have to set up TOTP on the same page.
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
        'verification.notice',
        'verification.verify',
        'verification.send',
        'theme.update',
        'logout',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->password_change_required || $request->routeIs(...self::ALLOWED_ROUTES)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            abort(Response::HTTP_FORBIDDEN, self::MESSAGE);
        }

        Inertia::flash('toast', ['type' => 'warning', 'message' => self::MESSAGE]);

        return redirect()->route('security.edit');
    }
}
