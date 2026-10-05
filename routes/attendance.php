<?php

use App\Http\Controllers\Attendance\Admin\AttendanceSettingsController;
use App\Http\Controllers\Attendance\Admin\HolidayController;
use App\Http\Controllers\Attendance\Admin\OfficeLocationController;
use App\Http\Controllers\Attendance\Admin\ShiftAssignmentController;
use App\Http\Controllers\Attendance\Admin\ShiftController;
use App\Http\Controllers\Attendance\AttendanceConsentController;
use App\Http\Controllers\Attendance\AttendanceController;
use App\Http\Controllers\Attendance\AttendanceSelfieController;
use App\Http\Controllers\Attendance\CheckInController;
use App\Http\Controllers\Attendance\CheckOutController;
use Illuminate\Support\Facades\Route;

// Sprint 2 — Absensi inti (docs/PROMPTS.md). Check-in/out: 6 attempts per minute per user.
// Named limiter defined in AppServiceProvider (6/min per user, ARCHITECTURE §5).
$throttle = 'throttle:check-in';

Route::middleware(['auth', 'verified'])->group(function () use ($throttle) {
    Route::get('absensi', [AttendanceController::class, 'index'])->name('attendance.index');
    Route::get('absensi/kebijakan-data', [AttendanceController::class, 'policy'])->name('attendance.policy');
    Route::post('absensi/persetujuan', [AttendanceConsentController::class, 'store'])->name('attendance.consent.store');
    Route::delete('absensi/persetujuan', [AttendanceConsentController::class, 'destroy'])->name('attendance.consent.destroy');
    Route::post('absensi/check-in', CheckInController::class)->middleware($throttle)->name('attendance.check-in');
    Route::post('absensi/check-out', CheckOutController::class)->middleware($throttle)->name('attendance.check-out');
    Route::get('absensi/log/{attendanceLog}/selfie', AttendanceSelfieController::class)
        ->middleware('signed')
        ->name('attendance.selfie');

    Route::prefix('admin/absensi')->name('admin.attendance.')->group(function () {
        Route::get('/', [AttendanceSettingsController::class, 'index'])->name('index');

        Route::post('lokasi', [OfficeLocationController::class, 'store'])->name('locations.store');
        Route::put('lokasi/{officeLocation}', [OfficeLocationController::class, 'update'])->name('locations.update');
        Route::delete('lokasi/{officeLocation}', [OfficeLocationController::class, 'destroy'])->name('locations.destroy');

        Route::post('shift', [ShiftController::class, 'store'])->name('shifts.store');
        Route::put('shift/{shift}', [ShiftController::class, 'update'])->name('shifts.update');
        Route::delete('shift/{shift}', [ShiftController::class, 'destroy'])->name('shifts.destroy');

        Route::get('penugasan', [ShiftAssignmentController::class, 'index'])->name('assignments.index');
        Route::post('penugasan', [ShiftAssignmentController::class, 'store'])->name('assignments.store');
        Route::post('penugasan/khusus', [ShiftAssignmentController::class, 'override'])->name('assignments.override');
        Route::delete('penugasan/{shiftAssignment}', [ShiftAssignmentController::class, 'destroy'])->name('assignments.destroy');

        Route::post('hari-libur', [HolidayController::class, 'store'])->name('holidays.store');
        Route::post('hari-libur/impor', [HolidayController::class, 'import'])->name('holidays.import');
        Route::put('hari-libur/{holiday}', [HolidayController::class, 'update'])->name('holidays.update');
        Route::delete('hari-libur/{holiday}', [HolidayController::class, 'destroy'])->name('holidays.destroy');
    });
});
