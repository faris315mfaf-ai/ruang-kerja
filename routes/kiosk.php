<?php

use App\Http\Controllers\Kiosk\KioskActivationController;
use App\Http\Controllers\Kiosk\KioskController;
use App\Http\Middleware\AuthenticateKiosk;
use Illuminate\Support\Facades\Route;

// Sprint 3 — lobby kiosk (docs/ARCHITECTURE.md §3.2). Guard `kiosk`;
// RestrictKioskDevice keeps a kiosk session on these `kiosk.*` routes only.
Route::get('kiosk', [KioskController::class, 'unpaired'])->name('kiosk.unpaired');

Route::middleware('throttle:10,1')->group(function () {
    Route::get('kiosk/aktivasi/{token}', [KioskActivationController::class, 'show'])->name('kiosk.activate.show');
    Route::post('kiosk/aktivasi/{token}', [KioskActivationController::class, 'store'])->name('kiosk.activate.store');
});

// Short pairing code typed on /kiosk (alternative to the link). Attempt
// limit + lockout per IP live in the controller so the screen gets a
// readable validation message instead of a bare 429.
Route::post('kiosk/aktivasi', [KioskActivationController::class, 'redeemCode'])->name('kiosk.activate.code');

Route::middleware(AuthenticateKiosk::class)->group(function () {
    Route::get('kiosk/{location}', [KioskController::class, 'show'])->whereUlid('location')->name('kiosk.show');
    Route::get('kiosk/{location}/kode', [KioskController::class, 'code'])->whereUlid('location')->name('kiosk.code');
});
