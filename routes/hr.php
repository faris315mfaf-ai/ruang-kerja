<?php

use App\Http\Controllers\HrHub\HrHubController;
use Illuminate\Support\Facades\Route;

/*
 * Ruang HR (keputusan pemilik 20 Okt 2026, docs/fitur/ruang-hr.md): the HR
 * workspace that replaces the HR dashboard. Only HR and Super Admin (Gate
 * `viewHrHub`, checked in the controller → 403 for everyone else).
 */
Route::middleware(['auth', 'verified'])->prefix('hr')->name('hr.')->group(function () {
    Route::get('/', [HrHubController::class, 'summary'])->name('summary');
    Route::get('absensi', [HrHubController::class, 'attendance'])->name('attendance');
    Route::get('monitoring', [HrHubController::class, 'monitoring'])->name('monitoring');
    Route::get('penugasan', [HrHubController::class, 'assignments'])->name('assignments');
    Route::get('jadwal', [HrHubController::class, 'schedule'])->name('schedule');
    Route::get('catatan', [HrHubController::class, 'notes'])->name('notes');

    Route::post('penugasan', [HrHubController::class, 'assign'])->middleware('throttle:30,1')->name('assignments.store');
    Route::post('monitoring/ingatkan', [HrHubController::class, 'remind'])->middleware('throttle:20,1')->name('monitoring.remind');
});
