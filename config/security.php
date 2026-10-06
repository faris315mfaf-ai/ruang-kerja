<?php

/*
|--------------------------------------------------------------------------
| HTTP security headers (App\Http\Middleware\SecurityHeaders)
|--------------------------------------------------------------------------
|
| Headers are set by the application so they apply behind any proxy (Herd,
| Caddy, a load balancer). The production Caddyfile only adds defaults for
| headers the app did not send. See docs/security/ASVS-L1.md.
|
*/

$origin = static function (mixed $url): ?string {
    if (! is_string($url) || $url === '') {
        return null;
    }

    $parts = parse_url($url);

    if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'])) {
        return null;
    }

    return $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
};

return [

    'csp' => [

        // Set false to drop the Content-Security-Policy header entirely (emergency switch).
        'enabled' => (bool) env('CSP_ENABLED', true),

        // Send Content-Security-Policy-Report-Only instead of enforcing (rollout aid).
        'report_only' => (bool) env('CSP_REPORT_ONLY', false),

        // Optional violation report endpoint (e.g. a Sentry CSP endpoint).
        'report_uri' => env('CSP_REPORT_URI'),

        /*
         * Browser-facing Reverb endpoint. The server-side broadcaster may talk
         * to Reverb internally (REVERB_HOST=reverb in Docker), so the client
         * values (VITE_REVERB_*) take precedence.
         */
        'reverb' => [
            'host' => env('VITE_REVERB_HOST', env('REVERB_HOST')),
            'port' => env('VITE_REVERB_PORT', env('REVERB_PORT')),
            'scheme' => env('VITE_REVERB_SCHEME', env('REVERB_SCHEME', 'https')),
        ],

        /*
         * Extra sources per directive. Google domains are required by the
         * Drive Picker (apis.google.com, docs.google.com), OAuth
         * (accounts.google.com), Drive previews (drive.google.com) and avatars
         * / Drive thumbnails (*.googleusercontent.com).
         */
        'sources' => [
            'script-src' => [
                'https://apis.google.com',
                'https://accounts.google.com',
            ],
            'connect-src' => array_values(array_filter([
                'https://apis.google.com',
                'https://www.googleapis.com',
                'https://content.googleapis.com',
                'https://accounts.google.com',
                // Catatan bersama: collab server WebSocket (config/collab.php, e.g. ws://127.0.0.1:1234 locally).
                $origin(env('VITE_COLLAB_URL', env('APP_ENV') === 'local' ? 'ws://127.0.0.1:'.env('COLLAB_PORT', 1234) : null)),
            ])),
            'img-src' => array_values(array_filter([
                'https://*.googleusercontent.com',
                'https://drive.google.com',
                'https://docs.google.com',
                // Attendance maps (Leaflet + OpenStreetMap tiles, Sprint 2).
                'https://tile.openstreetmap.org',
                // Private object storage (selfies, attachments) served through signed URLs.
                $origin(env('AWS_URL')),
                $origin(env('AWS_ENDPOINT')),
            ])),
            'frame-src' => [
                'https://accounts.google.com',
                'https://docs.google.com',
                'https://drive.google.com',
            ],
            'form-action' => [
                // Google OAuth redirect after the login form/button POST.
                'https://accounts.google.com',
            ],
        ],

        /*
         * Paths of the package dashboards (Horizon, Pulse). Their bundled
         * Vue/Alpine front-ends need 'unsafe-inline'/'unsafe-eval'; access is
         * limited to super_admin by the viewHorizon/viewPulse gates.
         */
        'relaxed_paths' => [
            trim((string) env('HORIZON_PATH', 'horizon'), '/'),
            trim((string) env('PULSE_PATH', 'pulse'), '/'),
        ],
    ],

    'hsts' => [
        // Only sent when APP_ENV=production.
        'max_age' => (int) env('HSTS_MAX_AGE', 31536000),
        'include_subdomains' => (bool) env('HSTS_INCLUDE_SUBDOMAINS', true),
    ],

    'permissions_policy' => 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()',

    'referrer_policy' => 'strict-origin-when-cross-origin',

];
