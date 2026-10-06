<?php

use App\Http\Controllers\Reports\DailyReportController;
use Illuminate\Support\Facades\Route;

/*
 * Laporan progres harian (keputusan pemilik 6 Okt 2026; docs/fitur/laporan-harian.md).
 * Authorization: DailyReportPolicy (readers other than the owner: direct
 * manager, Kepala Divisi of the division, Direksi, HR, Super Admin; else 404).
 */
Route::middleware(['auth', 'verified'])->prefix('laporan')->name('reports.')->group(function () {
    Route::get('/', [DailyReportController::class, 'index'])->name('index');
    Route::get('hari-ini', [DailyReportController::class, 'today'])->name('today');
    Route::put('hari-ini', [DailyReportController::class, 'save'])->middleware('throttle:60,1')->name('save');
    Route::post('hari-ini/kirim', [DailyReportController::class, 'submit'])->middleware('throttle:30,1')->name('submit');
    Route::get('tugas', [DailyReportController::class, 'tasks'])->middleware('throttle:search')->name('tasks');
    Route::get('{user}', [DailyReportController::class, 'person'])->whereUlid('user')->name('person');
    Route::get('{user}/{date}', [DailyReportController::class, 'show'])->whereUlid('user')->where('date', '\d{4}-\d{2}-\d{2}')->name('show');
});
