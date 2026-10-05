<?php

use App\Http\Controllers\Privacy\PrivacyController;
use App\Http\Controllers\Privacy\PrivacyPolicyController;
use Illuminate\Support\Facades\Route;

/*
| Privasi & data saya (Sprint 10, UU PDP). The privacy policy is public (linked
| from the login page); "Data Saya" and its export only ever show the signed-in
| user's own data. Withdrawing/giving consent reuses the attendance consent
| routes (attendance.consent.destroy / .store).
*/

Route::get('kebijakan-privasi', PrivacyPolicyController::class)->name('privacy.policy');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('privasi', [PrivacyController::class, 'index'])->name('privacy.index');
    Route::get('privasi/ekspor/{format}', [PrivacyController::class, 'export'])
        ->whereIn('format', ['xlsx', 'pdf'])
        ->middleware('throttle:10,1')
        ->name('privacy.export');
});
