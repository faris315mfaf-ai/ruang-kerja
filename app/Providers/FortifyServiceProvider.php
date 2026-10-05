<?php

namespace App\Providers;

use App\Actions\Fortify\ResetUserPassword;
use App\Domain\Auth\Actions\AuthenticateSuperAdmin;
use App\Domain\Auth\Support\GoogleOAuth;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Models\Company;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\Http\Controllers\PasswordResetLinkController as FortifyPasswordResetLinkController;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Reset links: Super Admins only, generic answer, throttled per IP.
        $this->app->bind(FortifyPasswordResetLinkController::class, PasswordResetLinkController::class);
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
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);

        // Email + password: Super Admin only (TOTP enforced afterwards).
        Fortify::authenticateUsing(fn (Request $request) => app(AuthenticateSuperAdmin::class)->handle($request));
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(function (Request $request) {
            $company = Company::query()->oldest()->first(['id', 'name', 'google_domain']);
            $googleEmail = $request->session()->get('google_email');

            return Inertia::render('auth/login', [
                'canResetPassword' => Features::enabled(Features::resetPasswords()),
                'status' => $request->session()->get('status'),
                'demoAccounts' => DemoAccounts::loginPageProps(),
                'google' => [
                    'enabled' => GoogleOAuth::configured(),
                    'domain' => $company?->google_domain,
                    'rejectedEmail' => is_string($googleEmail) ? $googleEmail : null,
                ],
                'companyName' => $company?->name,
            ]);
        });

        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email,
            'token' => $request->route('token'),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]));

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

        // Password login: 5/min per email+IP and 10/min per IP (ARCHITECTURE §5).
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->string(Fortify::username())->value()).'|'.$request->ip());

            return [
                Limit::perMinute(5)->by($throttleKey),
                Limit::perMinute(10)->by('ip|'.$request->ip()),
            ];
        });

        // Google callback only: 60/min per client IP (dozens of employees share the
        // office NAT at 08:00) and 10/min per browser session behind that IP.
        // The client IP is resolved behind TRUSTED_PROXIES (config/trustedproxy.php).
        // Forgot-password form: 5/min per IP (the answer is always generic).
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(5)->by('password-reset|'.$request->ip()));

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
