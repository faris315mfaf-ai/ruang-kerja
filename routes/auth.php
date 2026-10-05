<?php

use App\Http\Controllers\Auth\GoogleLoginController;
use Illuminate\Support\Facades\Route;

// Google Workspace sign-in (PRD M1). Rate limit `google-login`: 10/min/IP.
Route::middleware(['guest', 'throttle:google-login'])->prefix('auth/google')->name('auth.google.')->group(function () {
    Route::get('redirect', [GoogleLoginController::class, 'redirect'])->name('redirect');
    Route::get('callback', [GoogleLoginController::class, 'callback'])->name('callback');
});
