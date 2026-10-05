<?php

namespace App\Providers;

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Dashboards (Sprint 9 part A): there is no model behind a dashboard, so the
 * ability lives here instead of a Policy.
 */
class AnalyticsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::define('viewDashboard', fn (User $user, DashboardView $view): bool => app(DashboardAccess::class)->can($user, $view));
    }
}
