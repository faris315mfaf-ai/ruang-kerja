<?php

use App\Http\Controllers\Api\Monitoring\MonitoringReportController;
use App\Http\Controllers\Api\Reports\DailyReportController;
use App\Http\Controllers\Api\Reports\ReportHistoryController;
use App\Http\Controllers\Api\Reports\TeamReportController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Bagian 4 / B4-C — Laporan progres harian (token Sanctum)
|--------------------------------------------------------------------------
|
| Dimuat di dalam grup v1 `auth:sanctum` (routes/api.php). Controller tipis di
| atas Action / Query / Policy web yang sama (SaveDailyReport,
| SubmitDailyReport, MyDailyReports, ReportTaskOptions, DailyWorkMonitor,
| DailyReportPolicy, Gate monitorDailyReport). Throttle sama dengan web
| (routes/reports.php). Dokumen: docs/sesi/ponsel-b4c-laporan.md.
*/

Route::prefix('laporan')->name('reports.')->group(function (): void {
    Route::get('/', [ReportHistoryController::class, 'index'])->name('index');
    Route::get('hari-ini', [DailyReportController::class, 'today'])->name('today');
    Route::put('hari-ini', [DailyReportController::class, 'save'])->middleware('throttle:60,1')->name('save');
    Route::post('hari-ini/kirim', [DailyReportController::class, 'submit'])->middleware('throttle:30,1')->name('submit');
    Route::get('cari-tugas', [DailyReportController::class, 'tasks'])->middleware('throttle:search')->name('tasks');
    Route::get('tim', TeamReportController::class)->name('team');
    Route::get('orang/{user}', [ReportHistoryController::class, 'person'])->whereUlid('user')->name('person');
    Route::get('{dailyReport}', [ReportHistoryController::class, 'show'])->whereUlid('dailyReport')->name('show');
});

Route::get('monitoring/laporan/{dailyReport}', MonitoringReportController::class)
    ->whereUlid('dailyReport')->name('monitoring.reports.show');
