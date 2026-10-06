<?php

use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Http\Controllers\RoleDashboards\RoleApprovalController;
use App\Http\Controllers\RoleDashboards\RoleDashboardController;
use App\Http\Controllers\RoleDashboards\RoleDecisionController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
 * Dashboard per jabatan (F3, docs/fitur/dashboard-peran.md). Behind
 * FEATURE_ROLE_DASHBOARDS (config/features.php): 404 while off.
 * Authorization: Gate `viewRoleDashboard` (own position's dashboard_role, or
 * Direksi / Super Admin for every key; otherwise 404) + the policies of the
 * actions reused by the flows (project decisions, approvals).
 */
Route::middleware([EnsureFeatureEnabled::class.':role_dashboards', 'auth', 'verified'])->prefix('peran')->name('roles.')->group(function () {
    Route::get('/', [RoleDashboardController::class, 'index'])->name('index');
    Route::get('{role}', [RoleDashboardController::class, 'show'])->whereIn('role', DashboardRole::values())->name('show');

    Route::post('{role}/keputusan/{projectUpdate}', [RoleDecisionController::class, 'resolve'])
        ->whereIn('role', DashboardRole::values())->whereUlid('projectUpdate')->name('decisions.resolve');
    Route::post('{role}/keputusan/{projectUpdate}/minta-update', [RoleDecisionController::class, 'requestUpdate'])
        ->whereIn('role', DashboardRole::values())->whereUlid('projectUpdate')->name('decisions.request-update');

    Route::post('{role}/persetujuan/{employeeRequest}/setujui', [RoleApprovalController::class, 'approve'])
        ->whereIn('role', DashboardRole::values())->whereUlid('employeeRequest')->name('approvals.approve');
    Route::post('{role}/persetujuan/{employeeRequest}/tolak', [RoleApprovalController::class, 'reject'])
        ->whereIn('role', DashboardRole::values())->whereUlid('employeeRequest')->name('approvals.reject');
    Route::post('{role}/persetujuan/{employeeRequest}/revisi', [RoleApprovalController::class, 'revise'])
        ->whereIn('role', DashboardRole::values())->whereUlid('employeeRequest')->name('approvals.revise');
});
