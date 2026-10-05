<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted proxies
    |--------------------------------------------------------------------------
    |
    | Read by Illuminate\Http\Middleware\TrustProxies. Production sits behind
    | Caddy on the Docker network, so trust the private ranges there (see
    | .env.production.example). Leave empty locally. Accepts "*" or a comma
    | separated list of IPs/CIDRs.
    |
    */

    'proxies' => env('TRUSTED_PROXIES'),

];
