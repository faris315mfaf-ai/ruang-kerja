<?php

use App\Http\Controllers\Api\Inbox\InboxActionController;
use App\Http\Controllers\Api\Inbox\InboxController;
use App\Http\Controllers\Api\Notifications\NotificationSettingsController;
use App\Http\Controllers\Api\Search\SearchController;
use Illuminate\Support\Facades\Route;

/*
| API v1 — Bagian 2 paket B2-C: Inbox, cari global, pengaturan notifikasi.
|
| Dimuat di dalam grup auth:sanctum + throttle:api-v1 (routes/api.php), jadi
| prefiks `/api/v1` dan nama `api.v1.` sudah terpasang. `GET /inbox` dan
| `POST /inbox/{id}/baca` tetap di routes/api.php (perilakunya diperluas di
| Api\Inbox\InboxController). Rincian kontrak: docs/sesi/ponsel-b2c-inbox.md.
*/

// Inbox: detail + aksi. Aksi massal/baca-semua didaftarkan sebelum {notification}
// (segmennya bukan UUID, jadi tidak bentrok, tetapi urutan ini lebih jelas dibaca).
Route::post('inbox/baca-semua', [InboxActionController::class, 'readAll'])->name('inbox.read-all');
Route::post('inbox/massal', [InboxActionController::class, 'bulk'])->name('inbox.bulk');

Route::prefix('inbox/{notification}')->whereUuid('notification')->name('inbox.')->group(function (): void {
    Route::get('/', [InboxController::class, 'show'])->name('show');
    Route::post('belum-baca', [InboxActionController::class, 'unread'])->name('unread');
    Route::post('arsip', [InboxActionController::class, 'archive'])->name('archive');
    Route::post('batal-arsip', [InboxActionController::class, 'unarchive'])->name('unarchive');
});

// Cari global (penyaring visibilitas ada di tiap SearchProvider).
Route::get('cari', SearchController::class)->middleware('throttle:search')->name('search');

// Pengaturan notifikasi.
Route::prefix('pengaturan/notifikasi')->name('settings.notifications.')->group(function (): void {
    Route::get('/', [NotificationSettingsController::class, 'show'])->name('show');
    Route::put('/', [NotificationSettingsController::class, 'update'])->name('update');
    Route::get('ringkasan', [NotificationSettingsController::class, 'digest'])->name('digest');
    Route::post('uji', [NotificationSettingsController::class, 'test'])->middleware('throttle:notification-test')->name('test');
});
