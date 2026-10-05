<?php

use App\Http\Controllers\Management\DashboardController;
use Illuminate\Support\Facades\Route;

/*
 * Dashboard Manajemen (design MgDashboard). Authorization: Gate
 * `viewManagementDashboard` (App\Providers\AnalyticsServiceProvider) =
 * `dashboard.view_company` (Direksi, HR, Super Admin).
 */
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('manajemen', DashboardController::class)->name('management.dashboard');
});
