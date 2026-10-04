<?php

use App\Http\Controllers\Auth\DemoLoginController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Mobile "Menu" tab (also reachable on desktop).
    Route::inertia('menu', 'menu')->name('menu');

    // Shell entries whose modules arrive in later sprints. Each sprint replaces
    // its entry with real routes.
    $upcoming = [
        'inbox' => ['inbox', 'Inbox'],
        'tugas' => ['tasks.mine', 'Tugas saya'],
        'absensi' => ['attendance.index', 'Absensi'],
        'pengajuan' => ['requests.index', 'Pengajuan'],
        'persetujuan' => ['approvals.index', 'Persetujuan'],
        'workspace' => ['workspaces.index', 'Workspace'],
        'admin/karyawan' => ['admin.employees.index', 'Karyawan'],
        'pengaturan/notifikasi' => ['settings.notifications', 'Pengaturan notifikasi'],
        'privasi' => ['privacy.index', 'Privasi & data saya'],
    ];

    foreach ($upcoming as $uri => [$name, $title]) {
        Route::inertia($uri, 'placeholder', ['title' => $title])->name($name);
    }
});

// Local demo login (APP_ENV=local + DEMO_LOGIN_ENABLED=true; otherwise 404).
Route::post('login/demo', [DemoLoginController::class, 'store'])
    ->middleware(['guest', 'throttle:login'])
    ->name('login.demo');

require __DIR__.'/settings.php';
