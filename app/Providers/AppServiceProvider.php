<?php

namespace App\Providers;

use App\Domain\Attendance\Support\HolidayAwareWorkdayCalendar;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
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
        // Daily digest skips company holidays (Sprint 2 ↔ Sprint 8 contract).
        $this->app->bind(WorkdayCalendar::class, HolidayAwareWorkdayCalendar::class);
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
     * - `comments`: posting/editing task comments, 30/min per user.
     * - `drive-uploads`: starting a chunked Drive upload, google.upload.starts_per_minute
     *   per user; 429 body is Indonesian JSON (`code` drive_upload_throttled).
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

        RateLimiter::for('check-in', fn (Request $request): Limit => Limit::perMinute(config()->integer('attendance.rate_limit_per_minute', 6))
            ->by($this->userOrIpKey($request)));

        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(120)
            ->by($this->userOrIpKey($request)));

        // Task comments (post/edit): generous for humans, stops scripted floods of mention notifications.
        RateLimiter::for('comments', fn (Request $request): Limit => Limit::perMinute(30)
            ->by('comments|'.$this->userOrIpKey($request)));

        // Opening chunked Drive upload sessions (each reserves disk space until finished).
        // The upload client shows `message` as is: Indonesian instead of "Too Many Attempts.".
        RateLimiter::for('drive-uploads', fn (Request $request): Limit => Limit::perMinute(config()->integer('google.upload.starts_per_minute', 20))
            ->by('drive-uploads|'.$this->userOrIpKey($request))
            ->response(fn (Request $request, array $headers): JsonResponse => response()->json([
                'message' => 'Terlalu banyak unggahan. Coba lagi sebentar lagi.',
                'code' => 'drive_upload_throttled',
            ], 429, $headers)));
    }

    /**
     * Pulse (/pulse) is for super_admin only, in every environment (overrides
     * Pulse's default "local only" gate). Horizon: see HorizonServiceProvider.
     */
    protected function configureDashboards(): void
    {
        Gate::define('viewPulse', fn (?User $user = null): bool => $user?->isSuperAdmin() ?? false);

        // Global search (/cari): active employees; providers filter by visibility.
        Gate::define('search', fn (User $user): bool => $user->isActive());
    }

    private function userOrIpKey(Request $request): string
    {
        $user = $request->user();

        return $user instanceof User ? 'user:'.$user->getKey() : 'ip:'.$request->ip();
    }
}
