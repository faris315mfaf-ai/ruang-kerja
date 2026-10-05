<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Kiosk routes require a paired device (guard `kiosk`). Unlike `auth:kiosk`
 * it does not switch the default guard, so `$request->user()` keeps meaning
 * an employee (null on a kiosk) everywhere else in the request.
 */
class AuthenticateKiosk
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::guard('kiosk')->check()) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            abort(Response::HTTP_UNAUTHORIZED, 'Perangkat kiosk belum terdaftar.');
        }

        return redirect()->route('kiosk.unpaired');
    }
}
