<?php

namespace App\Http\Middleware;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Tenancy\CompanyContext;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fills CompanyContext for the request (Fase 1 multi-perusahaan): the
 * signed-in employee's company (web session or Sanctum token), or the
 * company of the kiosk device signed in on this browser (guard `kiosk`).
 *
 * Registered in the `web` and `api` groups and pinned right after
 * EnsureActiveEmployee in the priority list (bootstrap/app.php), so it runs
 * after `auth` / `auth:sanctum` has resolved the user. Guests keep an empty
 * context; public endpoints (meeting guests, webhooks, collab server) set it
 * themselves from the row their token resolves to.
 */
class ResolveCompanyContext
{
    public function __construct(private readonly CompanyContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user instanceof User) {
            $this->context->set($user->company_id);
        } elseif ($request->hasSession() && Auth::guard('kiosk')->id() !== null) {
            $kiosk = Auth::guard('kiosk')->user();

            if ($kiosk instanceof Kiosk) {
                $this->context->set($kiosk->company_id);
            }
        }

        return $next($request);
    }
}
