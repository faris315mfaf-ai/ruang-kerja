<?php

use App\Http\Controllers\Api\Attendance\AttendanceDayController;
use App\Http\Controllers\Api\Attendance\AttendanceRecapController;
use App\Http\Controllers\Api\Attendance\QrCheckController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B2-A Absensi (Bagian 2) — dimuat di dalam grup v1 `auth:sanctum` + `api-v1`
|--------------------------------------------------------------------------
|
| Check-in/out lewat QR kiosk (Action & penolakan web), detail hari, rekap
| bulanan pribadi dan unduhannya. Hari-ini dan riwayat yang sudah ada
| (routes/api.php) diperluas di tempatnya. Dokumen: docs/sesi/ponsel-b2a-absensi.md.
*/

Route::post('absensi/check-in/qr', [QrCheckController::class, 'checkIn'])
    ->middleware('throttle:check-in')->name('attendance.check-in.qr');
Route::post('absensi/check-out/qr', [QrCheckController::class, 'checkOut'])
    ->middleware('throttle:check-in')->name('attendance.check-out.qr');

Route::get('absensi/hari/{date}', AttendanceDayController::class)->name('attendance.day');
Route::get('absensi/rekap', [AttendanceRecapController::class, 'show'])->name('attendance.recap');
Route::get('absensi/rekap/unduh', [AttendanceRecapController::class, 'download'])
    ->middleware('throttle:10,1')->name('attendance.recap.download');
