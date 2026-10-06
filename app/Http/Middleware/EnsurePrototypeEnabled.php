<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fase 2 & 3 preview routes (routes/prototype.php) exist only while the
 * `prototype` feature flag is on; otherwise they answer 404.
 */
class EnsurePrototypeEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless((bool) config('features.prototype'), 404);

        return $next($request);
    }
}
