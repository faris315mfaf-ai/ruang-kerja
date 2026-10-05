<?php

namespace App\Providers;

use App\Actions\Fortify\ResetUserPassword;
use App\Domain\Auth\Actions\AuthenticateSuperAdmin;
use App\Domain\Auth\Support\GoogleOAuth;
use App\Domain\Organization\Demo\DemoAccounts;
use App\Models\Company;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Laravel\Fortify\Features;
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

        // The `login` limiter (10/min per IP + 5/min per email+IP) lives in
        // AppServiceProvider with the other named limiters (check-in, api).

        RateLimiter::for('google-login', fn (Request $request) => Limit::perMinute(10)->by((string) $request->ip()));
    }
}
