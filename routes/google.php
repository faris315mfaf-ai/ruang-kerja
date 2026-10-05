<?php

use App\Http\Controllers\Google\GoogleConnectionController;
use App\Http\Controllers\Google\GoogleSettingsController;
use App\Http\Controllers\Google\PickerTokenController;
use Illuminate\Support\Facades\Route;

// Google Drive integration (Sprint 7). Login with Google lives in the auth routes.
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('settings/google', [GoogleSettingsController::class, 'edit'])->name('settings.google');

    Route::get('google/connect', [GoogleConnectionController::class, 'redirect'])->name('google.connect');
    Route::get('google/connect/callback', [GoogleConnectionController::class, 'callback'])->name('google.callback');
    Route::delete('google/connect', [GoogleConnectionController::class, 'destroy'])->name('google.disconnect');

    Route::get('google/picker-token', PickerTokenController::class)
        ->middleware('throttle:30,1')
        ->name('google.picker-token');
});
