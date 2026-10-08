<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Audit R-14: Permissions-Policy applies per document, and an Inertia
 * navigation keeps the previous document alive. The video pages (/gabung,
 * /ruang) must therefore always be a full document load — an Inertia visit
 * is answered with `X-Inertia-Location`, which the client follows as
 * window.location. Partial reloads of the page itself are kept.
 */
class EnsureFullPageLoad
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->header('X-Inertia') && ! $request->header('X-Inertia-Partial-Component')) {
            return Inertia::location($request->fullUrl());
        }

        return $next($request);
    }
}
