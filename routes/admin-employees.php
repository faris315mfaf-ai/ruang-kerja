<?php

use App\Http\Controllers\Admin\EmployeeController;
use App\Http\Controllers\Admin\EmployeeImportController;
use App\Http\Controllers\Admin\EmployeePasswordController;
use Illuminate\Support\Facades\Route;

// Admin › Karyawan (Sprint 1). Authorization lives in UserPolicy (viewAny/manage/...).
Route::middleware(['auth', 'verified'])
    ->prefix('admin/karyawan')
    ->name('admin.employees.')
    ->group(function () {
        Route::get('/', [EmployeeController::class, 'index'])->name('index');
        Route::post('/', [EmployeeController::class, 'store'])->name('store');

        Route::get('impor', [EmployeeImportController::class, 'show'])->name('import');
        Route::get('impor/templat/{format}', [EmployeeImportController::class, 'template'])
            ->whereIn('format', ['csv', 'xlsx'])
            ->name('import.template');
        Route::post('impor', [EmployeeImportController::class, 'preview'])
            ->middleware('throttle:20,1')
            ->name('import.preview');
        Route::post('impor/{token}', [EmployeeImportController::class, 'commit'])
            ->whereAlphaNumeric('token')
            ->name('import.commit');

        // "Lupa kata sandi" requests (owner decision 6 Oct 2026): HR approves / rejects.
        Route::post('permintaan-sandi/{passwordResetRequest}/setujui', [EmployeePasswordController::class, 'approve'])
            ->whereUlid('passwordResetRequest')
            ->name('password-resets.approve');
        Route::post('permintaan-sandi/{passwordResetRequest}/tolak', [EmployeePasswordController::class, 'reject'])
            ->whereUlid('passwordResetRequest')
            ->name('password-resets.reject');

        Route::get('{employee}', [EmployeeController::class, 'show'])->name('show');
        Route::put('{employee}', [EmployeeController::class, 'update'])->name('update');
        Route::post('{employee}/nonaktifkan', [EmployeeController::class, 'deactivate'])->name('deactivate');
        Route::post('{employee}/aktifkan', [EmployeeController::class, 'reactivate'])->name('reactivate');
        Route::post('{employee}/kata-sandi', [EmployeePasswordController::class, 'store'])
            ->middleware('throttle:20,1')
            ->name('password');
    });
