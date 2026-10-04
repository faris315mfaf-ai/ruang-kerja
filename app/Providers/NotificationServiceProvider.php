<?php

namespace App\Providers;

use App\Domain\Notifications\Contracts\UserAvailability;
use App\Domain\Notifications\Contracts\WhatsAppProvider;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Notifications\Support\AlwaysAvailable;
use App\Domain\Notifications\Support\NullWhatsAppProvider;
use App\Domain\Notifications\Support\WeekdayCalendar;
use App\Domain\Search\Services\SearchRegistry;
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
}
