<?php

namespace App\Providers;

use App\Domain\Analytics\Enums\DashboardView;
use App\Domain\Analytics\Services\DashboardAccess;
use App\Domain\Organization\Enums\Permission;
use App\Models\DailyReport;
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

        // Work monitoring (keputusan pemilik 6 Okt 2026): reading one sent daily
        // report from the Direksi dashboard or the Kepala Divisi panel. The
        // report form and its own policy belong to the Laporan module.
        Gate::define('monitorDailyReport', fn (User $user, DailyReport $report): Response => self::canMonitor($user, $report)
            ? Response::allow()
            : Response::denyAsNotFound());
    }

    /**
     * The author, Direksi / HR / Super Admin of the company
     * (dashboard.view_company), the author's direct manager and the Kepala
     * Divisi of the author's division. Drafts stay with their author
     * (Laporan module) and are never shown here.
     */
    public static function canMonitor(User $user, DailyReport $report): bool
    {
        if (! $user->isActive() || $report->company_id !== $user->company_id || ! $report->isSubmitted()) {
            return false;
        }

        if ($report->user_id === $user->id || $user->hasPermission(Permission::DashboardViewCompany)) {
            return true;
        }

        $author = $report->user;

        return $author->manager_id === $user->id
            || ($author->division_id !== null && in_array($author->division_id, $user->ledDivisionIds(), true));
    }
}
