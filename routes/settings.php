<?php

use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\ThemeController;
use App\Http\Middleware\RequirePasswordForSuperAdmin;
use Illuminate\Support\Facades\Route;

// Employee data is managed by HR (Admin › Karyawan): no self-service profile
// update, email change or account deletion.
Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');

    Route::patch('settings/theme', [ThemeController::class, 'update'])->name('theme.update');
});

Route::middleware(['auth', 'verified'])->group(function () {
    // Own password: every employee (UserPolicy::manageCredentials); the TOTP
    // section and its password confirmation: Super Admin only.
    Route::get('settings/security', [SecurityController::class, 'edit'])
        ->middleware(RequirePasswordForSuperAdmin::class)
        ->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');
});
