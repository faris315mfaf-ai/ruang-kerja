<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Http\Request;

/**
 * Pengaturan › Keamanan: a Super Admin confirms their password first (the page
 * manages TOTP). Other employees only see "Ubah kata sandi", which asks for the
 * current password itself, so no extra prompt (and no Super-Admin-only
 * password confirmation route) is needed.
 */
class RequirePasswordForSuperAdmin extends RequirePassword
{
    /**
     * @param  string|null  $redirectToRoute
     * @param  string|int|null  $passwordTimeoutSeconds
     * @return mixed
     */
    public function handle($request, Closure $next, $redirectToRoute = null, $passwordTimeoutSeconds = null)
    {
        /** @var Request $request */
        $user = $request->user();

        if (! $user instanceof User || ! $user->isSuperAdmin()) {
            return $next($request);
        }

        return parent::handle($request, $next, $redirectToRoute, $passwordTimeoutSeconds);
    }
}
