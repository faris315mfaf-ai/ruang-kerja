<?php

namespace App\Http\Middleware;

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * A Super Admin who signed in with email + password (or remember-me) must have
 * TOTP enabled and confirmed. Until then every page redirects to the security
 * settings, where only the 2FA setup routes (plus logout, verification and
 * theme) are reachable.
 *
 * Exempt: Google sign-in (Workspace enforces its own policy) and the local demo
 * login (only while APP_ENV=local and DEMO_LOGIN_ENABLED=true).
 */
class EnsureTwoFactorForSuperAdmin
{
    public const string MESSAGE = 'Aktifkan autentikasi dua faktor (TOTP) terlebih dahulu untuk melanjutkan.';

    /**
     * @var list<string>
     */
    public const array ALLOWED_ROUTES = [
        'security.edit',
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

        if (! $user instanceof User || $request->routeIs(...self::ALLOWED_ROUTES) || ! self::mustSetUp($request, $user)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            abort(Response::HTTP_FORBIDDEN, self::MESSAGE);
        }

        Inertia::flash('toast', ['type' => 'warning', 'message' => self::MESSAGE]);

        return redirect()->route('security.edit');
    }

    /**
     * Whether this session must finish the TOTP setup before doing anything else.
     */
    public static function mustSetUp(Request $request, User $user): bool
    {
        if (! $user->isSuperAdmin() || $user->hasEnabledTwoFactorAuthentication()) {
            return false;
        }

        $stored = $request->hasSession() ? $request->session()->get(LoginMethod::SESSION_KEY) : null;
        $method = is_string($stored) ? LoginMethod::tryFrom($stored) : null;

        return match ($method) {
            LoginMethod::Password, LoginMethod::Remember => true,
            LoginMethod::Demo => ! DemoAccounts::enabled(),
            // Google: Workspace policy applies. null: no sign-in happened in this
            // session (every login path records a method via RecordLogin), e.g. actingAs().
            LoginMethod::Google, null => false,
        };
    }
}
