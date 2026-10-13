<?php

use App\Http\Controllers\Api\Hr\EmployeeController;
use App\Http\Controllers\Api\Hr\OrganizationChartController;
use App\Http\Controllers\Api\Hr\PasswordResetRequestController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| B5-B HR & admin (Bagian 5) — dimuat di dalam grup v1 `auth:sanctum` + `api-v1`
|--------------------------------------------------------------------------
|
| Karyawan (baca), permintaan reset sandi (setujui/tolak), struktur
| organisasi, Absensi tim (hari ini, perlu ditinjau + selfie, koreksi, rekap,
| kedisiplinan) dan saldo cuti untuk aplikasi Android — controller tipis di
| atas Action/Policy/FormRequest/presenter web. Pengumuman ke divisi/tim
| sudah ada di b2b-beranda.php (POST /pengumuman, GET /pengumuman/audiens).
| Dokumen: docs/sesi/ponsel-b5b-hr.md.
*/

Route::name('hr.')->group(function (): void {
    // Karyawan
    Route::get('admin/karyawan', [EmployeeController::class, 'index'])->name('employees.index');
    Route::get('admin/karyawan/{employee}', [EmployeeController::class, 'show'])
        ->whereUlid('employee')->name('employees.show');

    // Permintaan reset kata sandi ("Lupa kata sandi" berpersetujuan HR)
    Route::get('admin/permintaan-sandi', [PasswordResetRequestController::class, 'index'])->name('password-resets.index');
    Route::post('admin/permintaan-sandi/{passwordResetRequest}/setujui', [PasswordResetRequestController::class, 'approve'])
        ->whereUlid('passwordResetRequest')->middleware('throttle:30,1')->name('password-resets.approve');
    Route::post('admin/permintaan-sandi/{passwordResetRequest}/tolak', [PasswordResetRequestController::class, 'reject'])
        ->whereUlid('passwordResetRequest')->middleware('throttle:30,1')->name('password-resets.reject');

    // Struktur organisasi (404 untuk staf)
    Route::get('organisasi/struktur', OrganizationChartController::class)->name('organization.chart');
});
