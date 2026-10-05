<?php

namespace App\Providers;

use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Notifications\Contracts\WhatsAppProvider;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Notifications\Support\AlwaysAvailable;
use App\Domain\Notifications\Support\NullWhatsAppProvider;
use App\Domain\Notifications\Support\WeekdayCalendar;
use App\Domain\Search\Services\SearchRegistry;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

/**
 * Default bindings for the notification & search infrastructure (Sprint 8).
 * Modules override a contract by binding their implementation in their own
 * provider (bindIf here never overwrites an existing binding).
 */
class NotificationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bindIf(UserAvailability::class, AlwaysAvailable::class);
        $this->app->bindIf(WorkdayCalendar::class, WeekdayCalendar::class);
        $this->app->bindIf(WhatsAppProvider::class, NullWhatsAppProvider::class);
        $this->app->singletonIf(SearchRegistry::class);
    }

    public function boot(): void
    {
        // Named limiters: unnamed `throttle:N,M` middlewares share one counter per
        // user, so polling or searching would exhaust the test-notification quota.
        $by = fn (string $name, Request $request): string => $name.'|'.($request->user()?->getAuthIdentifier() ?? $request->ip());

        RateLimiter::for('notification-feed', fn (Request $request) => Limit::perMinute(10)->by($by('feed', $request)));
        RateLimiter::for('notification-test', fn (Request $request) => Limit::perMinute(5)->by($by('test', $request)));
        RateLimiter::for('search', fn (Request $request) => Limit::perMinute(120)->by($by('search', $request)));
    }
}
