<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route middleware `LimitRequestBody:{bytes}`: answers 413 when the body is
 * larger than the limit (Content-Length header, then the actual length) —
 * for unauthenticated machine endpoints such as the LiveKit webhook (audit
 * R-07). The global TrimStrings / ConvertEmptyStringsToNull middleware skip
 * those paths (MeetingsServiceProvider), so nothing decodes the JSON first.
 */
final class LimitRequestBody
{
    public function handle(Request $request, Closure $next, string $bytes = '65536'): Response
    {
        $limit = max(1, (int) $bytes);
        $declared = $request->headers->get('Content-Length');

        if ((is_numeric($declared) && (int) $declared > $limit) || strlen($request->getContent()) > $limit) {
            return response()->json(['message' => 'Isi kiriman terlalu besar.'], 413);
        }

        return $next($request);
    }
}
