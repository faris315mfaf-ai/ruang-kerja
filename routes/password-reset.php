<?php

use App\Http\Controllers\Auth\ForgotPasswordController;
use Illuminate\Support\Facades\Route;

// "Lupa kata sandi" with HR approval (owner decision 6 Oct 2026). Guests only;
// limiters in FortifyServiceProvider (password-reset, -status, -setup).
Route::middleware('guest')
    ->prefix('lupa-sandi')
    ->name('password-reset.')
    ->controller(ForgotPasswordController::class)
    ->group(function () {
        Route::get('/', 'create')->name('create');
        Route::post('/', 'store')->middleware('throttle:password-reset')->name('store');
        Route::get('menunggu', 'waiting')->name('waiting');
        Route::get('status', 'status')->middleware('throttle:password-reset-status')->name('status');
        Route::get('sandi-baru', 'edit')->name('edit');
        Route::post('sandi-baru', 'update')->middleware('throttle:password-reset-setup')->name('update');
    });
