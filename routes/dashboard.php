<?php

use App\Http\Controllers\Dashboard\DashboardController;
use App\Http\Controllers\Dashboard\ManagementNoteController;
use App\Http\Controllers\Dashboard\MonitoringReportController;
use Illuminate\Support\Facades\Route;

/*
 * Dashboards (Sprint 9 part A, PRD M7). Authorization: Gate `viewDashboard`
 * (App\Providers\AnalyticsServiceProvider). Direksi = work monitoring
 * (keputusan pemilik 6 Okt 2026); the portfolio stays at /portofolio.
 */
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('dashboard/{view}', [DashboardController::class, 'show'])
        ->whereIn('view', ['saya', 'divisi', 'hr', 'direksi'])
        ->name('dashboard.show');
    Route::get('dashboard/{view}/ekspor', [DashboardController::class, 'export'])
        ->whereIn('view', ['saya', 'divisi', 'hr', 'direksi'])
        ->middleware('throttle:20,1')
        ->name('dashboard.export');

    // Work monitoring (keputusan pemilik 6 Okt 2026): one sent daily report (JSON detail sheet).
    Route::get('monitoring/laporan/{dailyReport}', MonitoringReportController::class)->whereUlid('dailyReport')->name('monitoring.reports.show');

    // "Catatan tindakan" of Direksi / management (Direksi dashboard, /manajemen).
    Route::post('catatan-tindakan', [ManagementNoteController::class, 'store'])->middleware('throttle:60,1')->name('management-notes.store');
    Route::put('catatan-tindakan/urutan', [ManagementNoteController::class, 'reorder'])->middleware('throttle:60,1')->name('management-notes.reorder');
    Route::patch('catatan-tindakan/{managementNote}', [ManagementNoteController::class, 'update'])->whereUlid('managementNote')->middleware('throttle:60,1')->name('management-notes.update');
    Route::delete('catatan-tindakan/{managementNote}', [ManagementNoteController::class, 'destroy'])->whereUlid('managementNote')->middleware('throttle:60,1')->name('management-notes.destroy');
});
