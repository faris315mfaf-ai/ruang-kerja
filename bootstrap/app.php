<?php

use App\Http\Controllers\HealthController;
use App\Http\Middleware\AuthenticateSession;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Http\Middleware\EnsurePasswordChanged;
use App\Http\Middleware\EnsureTwoFactorForSuperAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RestrictCredentialRoutes;
use App\Http\Middleware\RestrictKioskDevice;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
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

        $middleware->encryptCookies(except: ['appearance']);

        // Rich-text documents (Tiptap JSON of comments and task descriptions): spaces
        // around mentions and marks are content — never trim the text nodes.
        $middleware->trimStrings(except: ['body.content.*', 'description.content.*']);

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
        $middleware->alias(['auth.session' => AuthenticateSession::class]);

        $middleware->web(append: [
            // Logs out inactive/resigned users on any web request (no-op for guests).
            EnsureActiveEmployee::class,
            // Kiosk devices (guard `kiosk`) may only open their kiosk page (Sprint 3).
            RestrictKioskDevice::class,
            // Own password: every employee; password confirmation & 2FA: Super Admin only.
            RestrictCredentialRoutes::class,
            // Password-signed-in Super Admins must set up TOTP before anything else.
            EnsureTwoFactorForSuperAdmin::class,
            // A temporary password set by HR must be replaced before anything else.
            EnsurePasswordChanged::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Must run before `auth`, which Laravel's priority list would otherwise move ahead of it.
        $middleware->prependToPriorityList(before: AuthenticatesRequests::class, prepend: RestrictKioskDevice::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Reports to Sentry only when SENTRY_LARAVEL_DSN is set (no-op otherwise).
        Integration::handles($exceptions);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
