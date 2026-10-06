<?php

/**
 * @return array<string, mixed>
 */
function sessionConfigFor(string $environment): array
{
    $previous = $_SERVER['APP_ENV'] ?? null;
    $secure = [$_SERVER['SESSION_SECURE_COOKIE'] ?? null, $_ENV['SESSION_SECURE_COOKIE'] ?? null, getenv('SESSION_SECURE_COOKIE')];
    $_SERVER['APP_ENV'] = $environment;
    // env() also reads getenv(): CI copies .env.example (SESSION_SECURE_COOKIE=true).
    unset($_SERVER['SESSION_SECURE_COOKIE'], $_ENV['SESSION_SECURE_COOKIE']);
    putenv('SESSION_SECURE_COOKIE');

    try {
        return require config_path('session.php');
    } finally {
        $_SERVER['APP_ENV'] = $previous;
        [$server, $env, $process] = $secure;

        if ($server !== null) {
            $_SERVER['SESSION_SECURE_COOKIE'] = $server;
        }

        if ($env !== null) {
            $_ENV['SESSION_SECURE_COOKIE'] = $env;
        }

        if ($process !== false) {
            putenv("SESSION_SECURE_COOKIE={$process}");
        }
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
