<?php

/**
 * @return array<string, mixed>
 */
function sessionConfigFor(string $environment): array
{
    $previous = $_SERVER['APP_ENV'] ?? null;
    $_SERVER['APP_ENV'] = $environment;
    unset($_SERVER['SESSION_SECURE_COOKIE'], $_ENV['SESSION_SECURE_COOKIE']);

    try {
        return require config_path('session.php');
    } finally {
        $_SERVER['APP_ENV'] = $previous;
    }
}

it('marks the session cookie Secure in production by default', function () {
    expect(sessionConfigFor('production'))
        ->secure->toBeTrue()
        ->http_only->toBeTrue()
        ->same_site->toBe('lax');

    expect(sessionConfigFor('local')['secure'])->toBeFalse();
});

it('issues HttpOnly, SameSite=Lax session cookies', function () {
    $cookie = collect($this->get('/login')->headers->getCookies())
        ->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));

    expect($cookie)->not->toBeNull()
        ->and($cookie->isHttpOnly())->toBeTrue()
        ->and($cookie->getSameSite())->toBe('lax');
});
