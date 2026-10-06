<?php

namespace App\Http\Middleware;

use App\Domain\Notes\Services\CollabToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Internal collab-server endpoints (/internal/catatan/*): no session, no
 * CSRF — the caller proves itself with `Authorization: Bearer <COLLAB_SECRET>`
 * (constant-time compare). Without a configured secret the endpoints are off.
 */
class VerifyCollabSecret
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! CollabToken::enabled()) {
            abort(404);
        }

        $given = (string) $request->bearerToken();

        if ($given === '' || ! hash_equals((string) config('collab.secret'), $given)) {
            abort(401, 'Kunci server kolaborasi tidak valid.');
        }

        return $next($request);
    }
}
