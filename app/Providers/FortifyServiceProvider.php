<?php

namespace App\Providers;

use App\Domain\Auth\Actions\AuthenticateEmployee;
use App\Domain\Auth\Data\PasswordResetSession;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Tenancy\Support\SoleCompany;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureActions();
        $this->configureViews();
        $this->configureRateLimiting();
    }

    /**
     * Configure Fortify actions.
     */
    private function configureActions(): void
    {
        // Email + password for every active employee (owner decision 6 Oct 2026);
        // Super Admins then need TOTP. Forgotten passwords: routes/password-reset.php.
        Fortify::authenticateUsing(fn (Request $request) => app(AuthenticateEmployee::class)->handle($request));
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        // Google sign-in is on hold (owner decision 6 Oct 2026): its routes and code
        // stay (routes/auth.php) but the login page only offers email + password.
        Fortify::loginView(function (Request $request) {
            // A single-company installation shows its name; with several
            // companies the page shows the platform branding (no company yet).
            $company = SoleCompany::get(['id', 'name']);

            return Inertia::render('auth/login', [
                'status' => $request->session()->get('status'),
                'demoAccounts' => DemoAccounts::loginPageProps(),
                'companyName' => $company?->name,
            ]);
        });

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::twoFactorChallengeView(fn () => Inertia::render('auth/two-factor-challenge'));

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });

        // The `login` limiter (10/min per IP + 5/min per email+IP) lives in
        // AppServiceProvider with the other named limiters (check-in, api).

        // "Lupa kata sandi" (routes/password-reset.php). The answer is always the
        // same, so the limits apply whether or not the address exists:
        // - request form: 5/min per IP and 5/hour per address;
        // - status polling (every 5 s): 30/min per request (token in the session), or per IP;
        // - setting the new password: 6/min per IP.
        RateLimiter::for('password-reset', fn (Request $request) => [
            Limit::perMinute(5)->by('password-reset-ip|'.$request->ip()),
            Limit::perHour(5)->by('password-reset-email|'.Str::lower(trim($request->string('email')->toString()))),
        ]);

        RateLimiter::for('password-reset-status', function (Request $request) {
            $token = $request->hasSession() ? PasswordResetSession::from($request->session())?->token : null;

            return Limit::perMinute(30)->by('password-reset-status|'.($token !== null ? hash('sha256', $token) : $request->ip()));
        });

        RateLimiter::for('password-reset-setup', fn (Request $request) => Limit::perMinute(6)->by('password-reset-setup|'.$request->ip()));

        // Mobile app (POST /api/v1/auth/...): the same limits for the same
        // guest flows, with Indonesian JSON 429 bodies and keys that do not
        // need a session — the app sends the tokens itself.
        // - TOTP challenge: 5/min per challenge token + IP (and 20/min per IP);
        // - "Lupa kata sandi" request: 5/min per IP, 5/hour per address;
        // - status polling (every ~5 s): 30/min per request token, or per IP;
        // - new password after approval: 6/min per IP.
        $apiThrottled = static fn (string $message, string $code) => static fn (Request $request, array $headers): JsonResponse => response()->json([
            'message' => $message,
            'code' => $code,
        ], 429, $headers);

        RateLimiter::for('api-two-factor', fn (Request $request) => [
            Limit::perMinute(5)->by('api-2fa|'.hash('sha256', $request->string('challenge_token')->toString()).'|'.$request->ip())
                ->response($apiThrottled('Terlalu banyak percobaan kode. Tunggu satu menit lalu coba lagi.', 'two_factor_throttled')),
            Limit::perMinute(20)->by('api-2fa-ip|'.$request->ip())
                ->response($apiThrottled('Terlalu banyak percobaan kode. Tunggu satu menit lalu coba lagi.', 'two_factor_throttled')),
        ]);

        RateLimiter::for('api-password-reset', fn (Request $request) => [
            Limit::perMinute(5)->by('api-password-reset-ip|'.$request->ip())
                ->response($apiThrottled('Terlalu banyak permintaan. Coba lagi dalam satu menit.', 'throttled')),
            Limit::perHour(5)->by('api-password-reset-email|'.Str::lower(trim($request->string('email')->toString())))
                ->response($apiThrottled('Terlalu banyak permintaan untuk alamat ini. Coba lagi nanti.', 'throttled')),
        ]);

        RateLimiter::for('api-password-reset-status', function (Request $request) use ($apiThrottled) {
            $token = $request->header('X-Reset-Token') ?? $request->query('request_token');

            return Limit::perMinute(30)
                ->by('api-password-reset-status|'.(is_string($token) && $token !== '' ? hash('sha256', $token) : $request->ip()))
                ->response($apiThrottled('Terlalu sering memeriksa status. Coba lagi sebentar lagi.', 'throttled'));
        });

        RateLimiter::for('api-password-reset-setup', fn (Request $request) => Limit::perMinute(6)
            ->by('api-password-reset-setup|'.$request->ip())
            ->response($apiThrottled('Terlalu banyak percobaan. Coba lagi dalam satu menit.', 'throttled')));

        // Google callback only (sign-in on hold, routes kept): 60/min per client IP
        // (dozens of employees share the office NAT at 08:00) and 10/min per browser
        // session behind that IP. The client IP is resolved behind TRUSTED_PROXIES.

        RateLimiter::for('google-login', function (Request $request) {
            $ip = (string) $request->ip();
            $limits = [Limit::perMinute(60)->by('google-ip|'.$ip)];

            if ($request->hasSession()) {
                $limits[] = Limit::perMinute(10)->by('google-session|'.$ip.'|'.$request->session()->getId());
            }

            return $limits;
        });
    }
}
