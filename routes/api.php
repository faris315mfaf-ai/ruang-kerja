<?php

use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Devices\DeviceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API aplikasi ponsel (Tahap 1 — /api/v1)
|--------------------------------------------------------------------------
|
| JSON API untuk aplikasi Android (Expo). Autentikasi: token Sanctum per
| perangkat (diterbitkan POST /auth/login); otorisasi tetap lewat Policy
| per endpoint — token tidak memakai abilities granular (config/sanctum.php).
| Galat selalu JSON (shouldRenderJsonWhen di bootstrap/app.php). Rute modul
| berikutnya (absensi, tugas, inbox, …) ditambahkan di berkas routes/<modul>.php
| miliknya lalu di-require dari sini, seperti pola routes/web.php.
*/

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    // Masuk (tamu): throttle per IP; kegagalan kredensial juga menghitung
    // ke limiter `login` Fortify lewat AuthenticateEmployee.
    Route::post('auth/login', [AuthController::class, 'store'])
        ->middleware('throttle:api-login')
        ->name('auth.login');

    Route::middleware(['auth:sanctum', 'throttle:api-v1'])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'destroy'])->name('auth.logout');
        Route::get('auth/saya', [AuthController::class, 'show'])->name('auth.saya');

        // Perangkat saya (DevicePolicy: hanya pemilik — HR/Super Admin sengaja
        // tanpa akses). "{device}" = ULID.
        Route::get('perangkat', [DeviceController::class, 'index'])->name('devices.index');
        Route::delete('perangkat/{device}', [DeviceController::class, 'destroy'])->name('devices.destroy');
        Route::put('perangkat/{device}/push-token', [DeviceController::class, 'updatePushToken'])->name('devices.push-token');

        // absensi & tugas

        // inbox, workspace, pengajuan, briefing
    });
});
