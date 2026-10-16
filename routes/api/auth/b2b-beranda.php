<?php

use App\Http\Controllers\Api\Announcements\AnnouncementController;
use App\Http\Controllers\Api\Beranda\BerandaController;
use App\Http\Controllers\Api\Briefings\BriefingController;
use App\Http\Controllers\Api\Dashboard\DashboardController;
use App\Http\Controllers\Api\People\PeopleController;
use App\Http\Controllers\Api\Performance\PerformanceController;
use App\Http\Middleware\EnsureFeatureEnabled;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Bagian 2 / B2-B — Beranda, briefing, pengumuman, kinerja (token Sanctum)
|--------------------------------------------------------------------------
|
| Dimuat di dalam grup v1 `auth:sanctum` (routes/api.php). Controller tipis di
| atas Action / Query / Policy web yang sama. Dokumen: docs/sesi/ponsel-b2b-beranda.md.
*/

// Beranda saya (satu payload) dan dashboard non-staf.
Route::get('beranda', BerandaController::class)->name('home');
Route::get('dashboard/tampilan', [DashboardController::class, 'views'])->name('dashboard.views');
Route::get('dashboard/divisi', [DashboardController::class, 'division'])->name('dashboard.division');
Route::get('dashboard/hr', [DashboardController::class, 'hr'])->name('dashboard.hr');

// Briefing pagi & sore — menulis (membaca terakhir ada di routes/api.php).
Route::get('briefing/jendela', [BriefingController::class, 'window'])->name('briefing.window');
Route::post('briefing', [BriefingController::class, 'store'])->middleware('throttle:20,1')->name('briefing.store');
Route::post('briefing/delegasi', [BriefingController::class, 'delegate'])->middleware('throttle:20,1')->name('briefing.delegate');

// Cari orang (pemilih delegasi dll.).
Route::get('orang', PeopleController::class)->name('people.search');

// Pengumuman. "spanduk" dan "audiens" didaftarkan sebelum "{announcement}".
Route::prefix('pengumuman')->name('announcements.')->controller(AnnouncementController::class)->group(function (): void {
    Route::get('/', 'index')->name('index');
    Route::post('/', 'store')->middleware('throttle:20,1')->name('store');
    Route::get('spanduk', 'banner')->name('banner');
    Route::get('audiens', 'audiences')->name('audiences');
    Route::get('{announcement}', 'show')->whereUlid('announcement')->name('show');
    Route::delete('{announcement}', 'destroy')->whereUlid('announcement')->name('destroy');
    Route::post('{announcement}/tutup', 'dismiss')->whereUlid('announcement')->name('dismiss');
});

// Kinerja saya — di balik flag `automation` seperti web (404 saat mati).
Route::middleware(EnsureFeatureEnabled::class.':automation')->group(function (): void {
    Route::get('kinerja', [PerformanceController::class, 'show'])->name('performance.show');
    Route::get('kinerja/{subject}', [PerformanceController::class, 'user'])->whereUlid('subject')->name('performance.user');
});
