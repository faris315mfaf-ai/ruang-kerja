<?php

namespace App\Providers;

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Ruang HR (/hr, keputusan pemilik 20 Okt 2026): the HR workspace that
 * replaces the HR dashboard. Only active HR and Super Admin; everyone else
 * gets 403 on every /hr route.
 */
class HrHubServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::define('viewHrHub', fn (User $user): bool => self::canView($user));
    }

    public static function canView(User $user): bool
    {
        return $user->isActive() && $user->hasAnyRole([Role::Hr, Role::SuperAdmin]);
    }
}
