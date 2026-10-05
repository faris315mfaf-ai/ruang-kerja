<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Privasi › Data Saya (Sprint 10): no model behind the page, so the ability
 * lives here. Every active employee may see and export only their OWN data;
 * the queries are keyed on the signed-in user (App\Domain\Privacy\Services\MyData).
 */
class PrivacyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::define('viewOwnData', fn (User $user): bool => $user->isActive());
    }
}
