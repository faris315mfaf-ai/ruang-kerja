<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applicant data (Hiring API v1) must never be cached by the app, a proxy or
 * the HTTP cache of the phone (UU PDP, 30-day retention; owner decision for
 * Bagian 5): every response — data, validation errors and 404s alike — is
 * marked `Cache-Control: no-store, private`.
 */
class NoStoreApplicantData
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}
