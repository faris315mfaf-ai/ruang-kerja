<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted proxies
    |--------------------------------------------------------------------------
    |
    | Read by Illuminate\Http\Middleware\TrustProxies (headers configured in
    | bootstrap/app.php). Only requests coming from these addresses may set
    | X-Forwarded-For/-Proto/-Host, so rate limits and audit logs see the real
    | client IP behind a reverse proxy without letting clients spoof it.
    |
    | TRUSTED_PROXIES: comma-separated IPs/CIDRs, or "*" to trust the calling
    | proxy. Unset = loopback + private ranges (proxy on the same host or the
    | Docker network, e.g. Caddy in production — see .env.production.example).
    | Set but empty = trust no proxy.
    |
    */

    'proxies' => env('TRUSTED_PROXIES', '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7'),

];
