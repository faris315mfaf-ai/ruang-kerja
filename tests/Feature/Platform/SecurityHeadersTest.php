<?php

use Illuminate\Support\Facades\Vite;

/**
 * @return array<string, string>
 */
function cspDirectives(string $header): array
{
    return collect(explode(';', $header))
        ->map(fn (string $part): string => trim($part))
        ->filter()
        ->mapWithKeys(function (string $part): array {
            [$name, $values] = array_pad(explode(' ', $part, 2), 2, '');

            return [$name => $values];
        })
        ->all();
}

it('sends the baseline security headers on every response', function (string $uri) {
    $response = $this->get($uri);

    $response->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('X-Frame-Options', 'DENY')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
        ->assertHeader('Content-Security-Policy');

    $permissions = (string) $response->headers->get('Permissions-Policy');

    expect($permissions)->toContain('geolocation=(self)')
        ->toContain('camera=(self)')
        ->toContain('microphone=(self)')
        ->toContain('display-capture=(self)');
})->with(['/login', '/up', '/health', '/does-not-exist']);

it('uses a strict CSP with a per-request nonce shared with the page', function () {
    $response = $this->get('/login')->assertOk();

    $csp = cspDirectives((string) $response->headers->get('Content-Security-Policy'));
    $nonce = Vite::cspNonce();

    expect($nonce)->toBeString()->not->toBeEmpty()
        ->and($csp['script-src'])->toContain("'nonce-{$nonce}'")
        ->not->toContain('unsafe-inline')
        ->not->toContain('unsafe-eval')
        ->and($csp['frame-ancestors'])->toBe("'none'")
        ->and($csp['object-src'])->toBe("'none'")
        ->and($csp['base-uri'])->toBe("'self'")
        ->and($response->getContent())->toContain('<script nonce="'.$nonce.'">');
});

it('allows the Google domains the app needs', function () {
    $csp = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));

    expect($csp['script-src'])->toContain('https://apis.google.com')->toContain('https://accounts.google.com')
        ->and($csp['frame-src'])->toContain('https://docs.google.com')->toContain('https://drive.google.com')->toContain('https://accounts.google.com')
        ->and($csp['img-src'])->toContain('https://*.googleusercontent.com')
        ->and($csp['form-action'])->toContain('https://accounts.google.com');
});

it('allows the OpenStreetMap tiles of the attendance maps', function () {
    $csp = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));

    expect($csp['img-src'])->toContain('https://tile.openstreetmap.org');
});

it('allows the browser-facing Reverb WebSocket endpoint', function () {
    config([
        'security.csp.reverb.host' => 'ruangkerja.example.com',
        'security.csp.reverb.port' => 443,
        'security.csp.reverb.scheme' => 'https',
    ]);

    $csp = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));
    expect($csp['connect-src'])->toContain('wss://ruangkerja.example.com')
        ->not->toContain('wss://ruangkerja.example.com:443');

    config(['security.csp.reverb.port' => 8080, 'security.csp.reverb.scheme' => 'http']);

    $csp = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));
    expect($csp['connect-src'])->toContain('ws://ruangkerja.example.com:8080');
});

it('allows the LiveKit server of Video RuangKerja only when configured', function () {
    config(['livekit.url' => null]);
    $csp = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));
    expect($csp['connect-src'])->not->toContain('rapat.example.com');

    config(['livekit.url' => 'wss://rapat.example.com']);
    $csp = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));
    expect($csp['connect-src'])->toContain('wss://rapat.example.com')
        ->toContain('https://rapat.example.com');
});

it('also allows wss for a plain-ws Reverb, because pusher-js forces TLS on HTTPS pages', function () {
    config([
        'security.csp.reverb.host' => 'localhost',
        'security.csp.reverb.port' => 8081,
        'security.csp.reverb.scheme' => 'http',
    ]);

    $csp = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));

    expect($csp['connect-src'])->toContain('ws://localhost:8081')
        ->toContain('wss://localhost:8081');
});

it('adds HSTS and upgrade-insecure-requests only in production', function () {
    $response = $this->get('/login');
    $response->assertHeaderMissing('Strict-Transport-Security');
    expect(cspDirectives((string) $response->headers->get('Content-Security-Policy')))
        ->not->toHaveKey('upgrade-insecure-requests');

    $this->app['env'] = 'production';

    $response = $this->get('/login');
    $response->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    expect(cspDirectives((string) $response->headers->get('Content-Security-Policy')))
        ->toHaveKey('upgrade-insecure-requests');
});

it('allows the Vite dev server only in local', function () {
    $hot = tempnam(sys_get_temp_dir(), 'hot');
    file_put_contents($hot, 'https://ruangkerja.test:5173');

    $this->withVite();
    Vite::useHotFile($hot);

    try {
        $testing = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));
        expect($testing['script-src'])->not->toContain('ruangkerja.test:5173');

        $this->app['env'] = 'local';

        $local = cspDirectives((string) $this->get('/login')->headers->get('Content-Security-Policy'));
        expect($local['script-src'])->toContain('https://ruangkerja.test:5173')
            ->and($local['connect-src'])->toContain('wss://ruangkerja.test:5173');
    } finally {
        unlink($hot);
    }
});

it('relaxes script-src only for the Horizon and Pulse dashboards', function (string $uri) {
    $csp = cspDirectives((string) $this->get($uri)->headers->get('Content-Security-Policy'));

    expect($csp['script-src'])->toContain("'unsafe-eval'")
        ->not->toContain("'nonce-")
        ->and($csp['frame-ancestors'])->toBe("'none'");
})->with(['/horizon', '/horizon/dashboard', '/pulse']);

it('can switch the CSP to report-only or off', function () {
    config(['security.csp.report_only' => true]);
    $this->get('/login')
        ->assertHeaderMissing('Content-Security-Policy')
        ->assertHeader('Content-Security-Policy-Report-Only');

    config(['security.csp.enabled' => false]);
    $this->get('/login')
        ->assertHeaderMissing('Content-Security-Policy')
        ->assertHeaderMissing('Content-Security-Policy-Report-Only');
});
