<?php

use App\Http\Controllers\Auth\GoogleLoginController;
use Illuminate\Support\Facades\Route;

// Google Workspace sign-in (PRD M1). Only the callback (which talks to Google and
// signs in) is rate limited: `google-login` = 60/min per IP + 10/min per session.
Route::middleware('guest')->prefix('auth/google')->name('auth.google.')->group(function () {
    Route::get('redirect', [GoogleLoginController::class, 'redirect'])->name('redirect');
    Route::get('callback', [GoogleLoginController::class, 'callback'])->middleware('throttle:google-login')->name('callback');
});
