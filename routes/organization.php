<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Organization\DivisionController;
use App\Http\Controllers\Organization\OrganizationChartController;
use App\Http\Controllers\Organization\PositionController;
use App\Http\Controllers\Organization\TeamController;
use Illuminate\Support\Facades\Route;

/*
| Organization module (Sprint 1): org chart for everyone, master data for HR &
| Super Admin, audit log for Super Admin. Authorization lives in the controllers
| (Division/Team/Position/AuditLog policies).
*/

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('organisasi/struktur', OrganizationChartController::class)->name('organization.chart');

    Route::prefix('admin/organisasi')->name('admin.organization.')->group(function () {
        Route::redirect('/', '/admin/organisasi/divisi')->name('index');

        Route::get('divisi', [DivisionController::class, 'index'])->name('divisions.index');
        Route::post('divisi', [DivisionController::class, 'store'])->name('divisions.store');
        Route::put('divisi/{division}', [DivisionController::class, 'update'])->name('divisions.update');
        Route::delete('divisi/{division}', [DivisionController::class, 'destroy'])->name('divisions.destroy');
        Route::post('divisi/{division}/pulihkan', [DivisionController::class, 'restore'])->withTrashed()->name('divisions.restore');

        Route::get('tim', [TeamController::class, 'index'])->name('teams.index');
        Route::post('tim', [TeamController::class, 'store'])->name('teams.store');
        Route::put('tim/{team}', [TeamController::class, 'update'])->name('teams.update');
        Route::delete('tim/{team}', [TeamController::class, 'destroy'])->name('teams.destroy');
        Route::post('tim/{team}/pulihkan', [TeamController::class, 'restore'])->withTrashed()->name('teams.restore');

        Route::get('jabatan', [PositionController::class, 'index'])->name('positions.index');
        Route::post('jabatan', [PositionController::class, 'store'])->name('positions.store');
        Route::put('jabatan/{position}', [PositionController::class, 'update'])->name('positions.update');
        Route::delete('jabatan/{position}', [PositionController::class, 'destroy'])->name('positions.destroy');
        Route::post('jabatan/{position}/pulihkan', [PositionController::class, 'restore'])->withTrashed()->name('positions.restore');
    });

    Route::get('admin/audit', [AuditLogController::class, 'index'])->name('admin.audit.index');
});
