<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Routes behind a feature flag of config/features.php answer 404 while the
 * flag is off: `->middleware(EnsureFeatureEnabled::class.':chat')`.
 */
class EnsureFeatureEnabled
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        abort_unless((bool) config("features.{$feature}"), 404);

        return $next($request);
    }
}
