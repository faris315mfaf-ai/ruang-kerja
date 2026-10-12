<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Signs out any authenticated user whose status is no longer `active`
 * (inactive / resigned), immediately on their next request.
 *
 * Registered in the `web` and `api` groups (bootstrap/app.php), so it covers
 * every authenticated route; it is a no-op for guests. API requests get a 401
 * JSON body instead of the login redirect.
 */
class EnsureActiveEmployee
{
    public const string MESSAGE = 'Akun Anda tidak aktif. Hubungi HR bila ini keliru.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || $user->isActive()) {
            return $next($request);
        }

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        // The mobile API (/api/*) always answers JSON, whatever Accept it sent.
        if ($request->expectsJson() || $request->is('api/*')) {
            abort(Response::HTTP_UNAUTHORIZED, self::MESSAGE);
        }

        return redirect()->route('login')->withErrors(['email' => self::MESSAGE]);
    }
}
