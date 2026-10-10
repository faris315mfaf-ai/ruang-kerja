<?php

use App\Http\Controllers\Api\Attendance\AttendanceHistoryController;
use App\Http\Controllers\Api\Attendance\CheckInController;
use App\Http\Controllers\Api\Attendance\CheckOutController;
use App\Http\Controllers\Api\Attendance\MyAttendanceController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Briefings\LatestBriefingController;
use App\Http\Controllers\Api\Devices\DeviceController;
use App\Http\Controllers\Api\Inbox\InboxController;
use App\Http\Controllers\Api\Requests\RequestController;
use App\Http\Controllers\Api\Task\TaskController;
use App\Http\Controllers\Api\Task\TaskStatusController;
use App\Http\Controllers\Api\Workspaces\WorkspaceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API aplikasi ponsel (Tahap 1 — /api/v1)
|--------------------------------------------------------------------------
|
| JSON API untuk aplikasi Android (Expo). Autentikasi: token Sanctum per
| perangkat (diterbitkan POST /auth/login); otorisasi tetap lewat Policy
| per endpoint — token tidak memakai abilities granular (config/sanctum.php).
| Galat selalu JSON (shouldRenderJsonWhen di bootstrap/app.php). Rute modul
| berikutnya (absensi, tugas, inbox, …) ditambahkan di berkas routes/<modul>.php
| miliknya lalu di-require dari sini, seperti pola routes/web.php.
*/

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    // Masuk (tamu): throttle per IP; kegagalan kredensial juga menghitung
    // ke limiter `login` Fortify lewat AuthenticateEmployee.
    Route::post('auth/login', [AuthController::class, 'store'])
        ->middleware('throttle:api-login')
        ->name('auth.login');

    Route::middleware(['auth:sanctum', 'throttle:api-v1'])->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'destroy'])->name('auth.logout');
        Route::get('auth/saya', [AuthController::class, 'show'])->name('auth.saya');

        // Perangkat saya (DevicePolicy: hanya pemilik — HR/Super Admin sengaja
        // tanpa akses). "{device}" = ULID.
        Route::get('perangkat', [DeviceController::class, 'index'])->name('devices.index');
        Route::delete('perangkat/{device}', [DeviceController::class, 'destroy'])->name('devices.destroy');
        Route::put('perangkat/{device}/push-token', [DeviceController::class, 'updatePushToken'])->name('devices.push-token');

        // absensi & tugas — pemilik token sendiri; Action, presenter dan Policy
        // web dipakai ulang. Check-in/out memakai limiter `check-in` yang sama
        // dengan web (6/menit per user); penolakan bisnis berbody identik
        // ({message, reason, context} 422).
        Route::get('absensi/hari-ini', [MyAttendanceController::class, 'today'])->name('attendance.today');
        Route::get('absensi/riwayat', AttendanceHistoryController::class)->name('attendance.history');
        Route::post('absensi/check-in', CheckInController::class)
            ->middleware('throttle:check-in')->name('attendance.check-in');
        Route::post('absensi/check-out', CheckOutController::class)
            ->middleware('throttle:check-in')->name('attendance.check-out');

        // tugas — baca + pindah status saja (Tahap 1): membuat, menyunting
        // dan menghapus tugas tetap lewat web (penugasan atasan = alur web).
        Route::get('tugas/hari-ini', [TaskController::class, 'today'])->name('tasks.today');
        Route::get('tugas', [TaskController::class, 'index'])->name('tasks.index');
        Route::get('tugas/{task}', [TaskController::class, 'show'])->whereUlid('task')->name('tasks.show');
        Route::patch('tugas/{task}/status', TaskStatusController::class)->whereUlid('task')->name('tasks.status');

        // inbox — feed notifikasi aktif pemilik token (presenter web
        // InboxNotificationResource; ?belum-dibaca=1 menyaring) dan tandai
        // satu dibaca lewat Action web. Notifikasi orang lain tidak pernah
        // ter-resolve (scope visibleTo → 404); "{notification}" = UUID.
        Route::get('inbox', [InboxController::class, 'index'])->name('inbox.index');
        Route::post('inbox/{notification}/baca', [InboxController::class, 'read'])
            ->whereUuid('notification')->name('inbox.read');

        // workspace — semua yang terlihat pemilik (Workspace::visibleTo),
        // digroup seperti direktori web: pribadi · divisi · proyek · lainnya.
        Route::get('workspace', WorkspaceController::class)->name('workspaces.index');

        // pengajuan — "Pengajuan saya" pemilik (presenter web), jenis yang
        // bisa diajukan (LeaveType terlihat+aktif, tanpa yang terkunci/
        // belum eligible), dan kirim pengajuan baru lewat Action SubmitRequest
        // web (alur approval + notifikasinya sama; draf tetap alur web).
        Route::get('pengajuan/jenis', [RequestController::class, 'types'])->name('requests.types');
        Route::get('pengajuan', [RequestController::class, 'index'])->name('requests.index');
        Route::post('pengajuan', [RequestController::class, 'store'])->name('requests.store');

        // briefing — catatan terakhir perusahaan pemilik (baca saja);
        // 204 bila belum ada. Mencatat & delegasi tetap di web.
        Route::get('briefing/terakhir', LatestBriefingController::class)->name('briefing.latest');
    });
});
