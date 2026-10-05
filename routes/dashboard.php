<?php

use App\Http\Controllers\Dashboard\DashboardController;
use Illuminate\Support\Facades\Route;

/*
 * Dashboards (Sprint 9 part A, PRD M7). Authorization: Gate `viewDashboard`
 * (App\Providers\AnalyticsServiceProvider). The Direksi dashboard is the
 * portfolio at /portofolio (Sprint 9 part B).
 */
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('dashboard/{view}', [DashboardController::class, 'show'])
        ->whereIn('view', ['saya', 'divisi', 'hr'])
        ->name('dashboard.show');
    Route::get('dashboard/{view}/ekspor', [DashboardController::class, 'export'])
        ->whereIn('view', ['saya', 'divisi', 'hr'])
        ->middleware('throttle:20,1')
        ->name('dashboard.export');
});
