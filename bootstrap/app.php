<?php

use App\Http\Controllers\HealthController;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RestrictCredentialRoutes;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Sentry\Laravel\Integration;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function (): void {
            // Outside the `web` group: no session or cookies for uptime monitors.
            Route::get('health', HealthController::class)->name('health');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Global: covers every response (pages, /up, /health, errors, dashboards).
        $middleware->append(SecurityHeaders::class);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // Trusted reverse proxies come from config/trustedproxy.php (env TRUSTED_PROXIES,
        // default private ranges) — read at request time, so `config:cache` is safe.
        $middleware->trustProxies(headers: Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_HOST
            | Request::HEADER_X_FORWARDED_PORT
            | Request::HEADER_X_FORWARDED_PROTO
            | Request::HEADER_X_FORWARDED_AWS_ELB);

        // Sessions remember the password hash: changing the password (SecurityController)
        // signs out every other device on its next request.
        $middleware->authenticateSessions();

        $middleware->web(append: [
            // Logs out inactive/resigned users on any web request (no-op for guests).
            EnsureActiveEmployee::class,
            // Password/2FA routes: Super Admin only (everyone else uses Google).
            RestrictCredentialRoutes::class,
            // Password-signed-in Super Admins must set up TOTP before anything else.
            EnsureTwoFactorForSuperAdmin::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Reports to Sentry only when SENTRY_LARAVEL_DSN is set (no-op otherwise).
        Integration::handles($exceptions);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
