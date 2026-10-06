<?php

namespace App\Providers;

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Organization\Enums\Permission;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Domain\RoleDashboards\Services\RoleDashboardAccess;
use App\Models\User;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Dashboards (Sprint 9 part A, Dashboard Manajemen): there is no model behind
 * a dashboard, so the abilities live here instead of a Policy.
 */
class AnalyticsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::define('viewDashboard', fn (User $user, DashboardView $view): bool => app(DashboardAccess::class)->can($user, $view));

        // Dashboard Manajemen (/manajemen): company-wide summary for Direksi, HR and Super Admin.
        Gate::define('viewManagementDashboard', fn (User $user): bool => $user->isActive() && $user->hasPermission(Permission::DashboardViewCompany));

        // Dashboard per jabatan (/peran/{role}): own position's job, or every job for Direksi/Super Admin; else 404.
        Gate::define('viewRoleDashboard', fn (User $user, DashboardRole $role): Response => app(RoleDashboardAccess::class)->can($user, $role)
            ? Response::allow()
            : Response::denyAsNotFound());
    }
}
