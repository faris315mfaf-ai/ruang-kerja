<?php

use App\Http\Controllers\Attendance\Admin\AttendanceSettingsController;
use App\Http\Controllers\Attendance\Admin\HolidayController;
use App\Http\Controllers\Attendance\Admin\KioskController;
use App\Http\Controllers\Attendance\Admin\OfficeLocationController;
use App\Http\Controllers\Attendance\Admin\ShiftAssignmentController;
use App\Http\Controllers\Attendance\Admin\ShiftController;
use App\Http\Controllers\Attendance\AttendanceBoardController;
use App\Http\Controllers\Attendance\AttendanceConsentController;
use App\Http\Controllers\Attendance\AttendanceController;
use App\Http\Controllers\Attendance\AttendanceCorrectionController;
use App\Http\Controllers\Attendance\AttendanceLogController;
use App\Http\Controllers\Attendance\AttendanceRecapController;
use App\Http\Controllers\Attendance\AttendanceSelfieController;
use App\Http\Controllers\Attendance\CheckInController;
use App\Http\Controllers\Attendance\CheckOutController;
use App\Http\Controllers\Attendance\MyAttendanceHistoryController;
use App\Http\Controllers\Attendance\QrCheckController;
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
    // Sprint 3 — kiosk QR (same limiter).
    Route::post('absensi/check-in/qr', [QrCheckController::class, 'checkIn'])->middleware($throttle)->name('attendance.check-in.qr');
    Route::post('absensi/check-out/qr', [QrCheckController::class, 'checkOut'])->middleware($throttle)->name('attendance.check-out.qr');
    Route::get('absensi/log/{attendanceLog}/selfie', AttendanceSelfieController::class)
        ->middleware('signed')
        ->name('attendance.selfie');

    // Sprint 3 — HR review, recap & export, personal history.
    Route::get('absensi/riwayat', [MyAttendanceHistoryController::class, 'index'])->name('attendance.history');
    Route::get('absensi/riwayat/pdf', [MyAttendanceHistoryController::class, 'pdf'])->name('attendance.history.pdf');
    Route::get('absensi/hari-ini', [AttendanceBoardController::class, 'index'])->name('attendance.board');
    Route::get('absensi/rekap', [AttendanceRecapController::class, 'index'])->name('attendance.recap');
    Route::get('absensi/rekap/ekspor/{format}', [AttendanceRecapController::class, 'export'])->whereIn('format', ['xlsx', 'pdf'])->name('attendance.recap.export');
    Route::get('absensi/log/{attendanceLog}/selfie-url', [AttendanceLogController::class, 'selfieUrl'])->name('attendance.logs.selfie-url');
    Route::post('absensi/log/{attendanceLog}/tinjau', [AttendanceLogController::class, 'review'])->name('attendance.logs.review');
    Route::post('absensi/koreksi', [AttendanceCorrectionController::class, 'store'])->name('attendance.corrections.store');

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

        Route::post('kiosk', [KioskController::class, 'store'])->name('kiosks.store');
        Route::put('kiosk/{kiosk}', [KioskController::class, 'update'])->name('kiosks.update');
        Route::post('kiosk/{kiosk}/aktivasi', [KioskController::class, 'activation'])->name('kiosks.activation');
        Route::delete('kiosk/{kiosk}', [KioskController::class, 'destroy'])->name('kiosks.destroy');

        Route::post('hari-libur', [HolidayController::class, 'store'])->name('holidays.store');
        Route::post('hari-libur/impor', [HolidayController::class, 'import'])->name('holidays.import');
        Route::put('hari-libur/{holiday}', [HolidayController::class, 'update'])->name('holidays.update');
        Route::delete('hari-libur/{holiday}', [HolidayController::class, 'destroy'])->name('holidays.destroy');
    });
});
