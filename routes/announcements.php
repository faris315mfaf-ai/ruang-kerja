<?php

use App\Http\Controllers\Announcements\AnnouncementController;
use Illuminate\Support\Facades\Route;

/*
 * Pengumuman (keputusan pemilik 6 Okt 2026; docs/fitur/pengumuman.md).
 * Authorization: AnnouncementPolicy (not addressed to me → 404).
 */
Route::middleware(['auth', 'verified'])->prefix('pengumuman')->name('announcements.')->group(function () {
    Route::get('/', [AnnouncementController::class, 'index'])->name('index');
    Route::post('/', [AnnouncementController::class, 'store'])->middleware('throttle:20,1')->name('store');
    Route::get('spanduk', [AnnouncementController::class, 'banner'])->name('banner');
    Route::post('{announcement}/tutup', [AnnouncementController::class, 'dismiss'])->whereUlid('announcement')->name('dismiss');
    Route::delete('{announcement}', [AnnouncementController::class, 'destroy'])->whereUlid('announcement')->name('destroy');
});
