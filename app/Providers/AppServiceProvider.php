<?php

namespace App\Providers;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Fortify;

class AppServiceProvider extends ServiceProvider
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
        $this->configureDefaults();
        $this->configureModels();
        $this->configureRateLimiting();
        $this->configureDashboards();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Outside production, fail loudly on lazy loading (N+1), silently discarded
     * (non-fillable) attributes and access to attributes that were not selected.
     */
    protected function configureModels(): void
    {
        Model::shouldBeStrict(! app()->isProduction());
    }

    /**
     * Named rate limiters (docs/ARCHITECTURE.md §5). Apply with `throttle:<name>`:
     *
     * - `login`: Fortify login (config/fortify.php `limiters.login`). 10/min per IP,
     *   plus 5/min per email+IP so one account cannot be brute-forced from an IP.
     * - `check-in`: attendance check-in/out routes. 6/min per user.
     * - `api`: JSON API (Phase 3, Sanctum). 120/min per user, or per IP for guests.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('login', function (Request $request): array {
            $email = Str::transliterate(Str::lower((string) $request->input(Fortify::username())));

            return [
                Limit::perMinute(10)->by('ip|'.$request->ip()),
                Limit::perMinute(5)->by($email.'|'.$request->ip()),
            ];
        });

        RateLimiter::for('check-in', fn (Request $request): Limit => Limit::perMinute(6)
            ->by($this->userOrIpKey($request)));

        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(120)
            ->by($this->userOrIpKey($request)));
    }

    /**
     * Pulse (/pulse) is for super_admin only, in every environment (overrides
     * Pulse's default "local only" gate). Horizon: see HorizonServiceProvider.
     */
    protected function configureDashboards(): void
    {
        Gate::define('viewPulse', fn (?User $user = null): bool => $user?->isSuperAdmin() ?? false);
    }

    private function userOrIpKey(Request $request): string
    {
        $user = $request->user();

        return $user instanceof User ? 'user:'.$user->getKey() : 'ip:'.$request->ip();
    }
}
