<?php

/*
|--------------------------------------------------------------------------
| Trusted proxies
|--------------------------------------------------------------------------
|
| Read by Laravel's TrustProxies middleware (registered globally, see
| bootstrap/app.php). Only requests coming from these addresses may set
| X-Forwarded-For/-Proto/-Host, so rate limits and audit logs see the real
| client IP behind a reverse proxy without letting clients spoof it.
|
| TRUSTED_PROXIES: comma-separated IPs/CIDRs, or "*" to trust the calling
| proxy (only behind a load balancer that is the sole entry point).
| Default: loopback and private ranges (proxy on the same host/network).
|
*/

return [
    'proxies' => env('TRUSTED_PROXIES', '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7'),
];
