<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds security headers (CSP with a per-request nonce, HSTS in production,
 * Permissions-Policy, ...) to every response. Registered as global middleware
 * so it also covers /up, /health, error pages and the package dashboards.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        // Must run before the view renders so @vite tags and inline scripts get the nonce.
        $nonce = Vite::useCspNonce();

        $response = $next($request);

        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', (string) config('security.referrer_policy'));
        // Audit R-14: the grants are per document — the video pages get the
        // microphone/screen capture, every other document denies them.
        $headers->set('Permissions-Policy', (string) config(
            $request->routeIs('meetings.video.join', 'meetings.video.room')
                ? 'security.permissions_policy_meetings'
                : 'security.permissions_policy',
        ));
        // Google Picker / OAuth popups need to keep a reference to their opener.
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
        $headers->remove('X-Powered-By');

        if (app()->isProduction()) {
            $headers->set('Strict-Transport-Security', $this->hsts());
        }

        if (config('security.csp.enabled')) {
            $name = config('security.csp.report_only')
                ? 'Content-Security-Policy-Report-Only'
                : 'Content-Security-Policy';

            $headers->set($name, $this->contentSecurityPolicy($request, $nonce));
        }

        return $response;
    }

    private function hsts(): string
    {
        $value = 'max-age='.(int) config('security.hsts.max_age');

        if (config('security.hsts.include_subdomains')) {
            $value .= '; includeSubDomains';
        }

        return $value;
    }

    private function contentSecurityPolicy(Request $request, string $nonce): string
    {
        $relaxed = $this->isRelaxedPath($request);

        $directives = [
            'default-src' => ["'self'"],
            'base-uri' => ["'self'"],
            'object-src' => ["'none'"],
            'frame-ancestors' => ["'none'"],
            'form-action' => ["'self'"],
            'script-src' => $relaxed
                ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
                : ["'self'", "'nonce-{$nonce}'"],
            // Radix, sonner and the Inertia progress bar inject <style> elements.
            'style-src' => ["'self'", "'unsafe-inline'"],
            'img-src' => ["'self'", 'data:', 'blob:'],
            'font-src' => ["'self'", 'data:'],
            'connect-src' => ["'self'"],
            'media-src' => ["'self'", 'blob:'],
            'frame-src' => ["'self'"],
            'worker-src' => ["'self'"],
            'manifest-src' => ["'self'"],
        ];

        /** @var array<string, list<string>> $sources */
        $sources = config('security.csp.sources', []);

        foreach ($sources as $directive => $values) {
            $directives[$directive] = [...($directives[$directive] ?? []), ...$values];
        }

        foreach ($this->reverbOrigins() as $reverb) {
            $directives['connect-src'][] = $reverb;
        }

        foreach ($this->liveKitOrigins() as $liveKit) {
            $directives['connect-src'][] = $liveKit;
        }

        if ($vite = $this->viteDevServerOrigin()) {
            foreach (['script-src', 'style-src', 'img-src', 'font-src'] as $directive) {
                $directives[$directive][] = $vite;
            }

            $directives['connect-src'][] = $vite;
            $directives['connect-src'][] = preg_replace('/^http/', 'ws', $vite);
        }

        if (app()->isProduction()) {
            $directives['upgrade-insecure-requests'] = [];
        }

        if ($reportUri = config('security.csp.report_uri')) {
            $directives['report-uri'] = [(string) $reportUri];
        }

        return collect($directives)
            ->map(fn (array $values, string $directive): string => trim($directive.' '.implode(' ', array_unique($values))))
            ->implode('; ');
    }

    private function isRelaxedPath(Request $request): bool
    {
        /** @var list<string> $paths */
        $paths = config('security.csp.relaxed_paths', []);

        foreach ($paths as $path) {
            if ($path !== '' && $request->is($path, $path.'/*')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Video RuangKerja: the LiveKit signalling WebSocket (wss://…) and its
     * HTTP twin (the client calls /rtc/validate after a failed connect).
     *
     * @return list<string>
     */
    private function liveKitOrigins(): array
    {
        $url = config('livekit.url');

        if (! is_string($url) || $url === '') {
            return [];
        }

        $parts = parse_url($url);

        if (! is_array($parts) || ! isset($parts['scheme'], $parts['host']) || ! in_array($parts['scheme'], ['ws', 'wss'], true)) {
            return [];
        }

        $hostPort = $parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        $http = $parts['scheme'] === 'wss' ? 'https' : 'http';

        return [$parts['scheme'].'://'.$hostPort, $http.'://'.$hostPort];
    }

    /**
     * Browser-facing WebSocket origins of Reverb, e.g. wss://ruangkerja.test:8080.
     *
     * pusher-js always upgrades to wss on an HTTPS page, so a plain-ws Reverb
     * (local development) is allowed under both schemes.
     *
     * @return list<string>
     */
    private function reverbOrigins(): array
    {
        $host = config('security.csp.reverb.host');

        if (! is_string($host) || $host === '') {
            return [];
        }

        $secure = config('security.csp.reverb.scheme') === 'https';
        $port = (int) config('security.csp.reverb.port');
        $origin = fn (bool $tls): string => ($tls ? 'wss' : 'ws').'://'.$host
            .($port > 0 && $port !== ($tls ? 443 : 80) ? ':'.$port : '');

        return $secure ? [$origin(true)] : [$origin(false), $origin(true)];
    }

    /**
     * Origin of the Vite dev server (local only, while `npm run dev` runs).
     */
    private function viteDevServerOrigin(): ?string
    {
        if (! app()->isLocal() || ! Vite::isRunningHot()) {
            return null;
        }

        $url = trim(File::get(Vite::hotFile()));
        $parts = parse_url($url);

        if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'])) {
            return null;
        }

        return $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
    }
}
