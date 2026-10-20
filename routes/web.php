<?php

use App\Http\Controllers\Auth\DemoLoginController;
use App\Http\Controllers\Auth\DemoSwitchController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    // Mobile "Menu" tab (also reachable on desktop).
    Route::inertia('menu', 'menu')->name('menu');
});

// Local demo login (APP_ENV=local + DEMO_LOGIN_ENABLED=true; otherwise 404).
Route::post('login/demo', [DemoLoginController::class, 'store'])
    ->middleware(['guest', 'throttle:login'])
    ->name('login.demo');

// Account switcher at the top of the shell (same local-only guard).
Route::post('demo/ganti-akun', [DemoSwitchController::class, 'store'])
    ->middleware(['auth', 'throttle:login'])
    ->name('demo.switch');

require __DIR__.'/auth.php';
require __DIR__.'/password-reset.php';
require __DIR__.'/settings.php';
require __DIR__.'/requests.php';
require __DIR__.'/attendance.php';
require __DIR__.'/kiosk.php';
require __DIR__.'/admin-employees.php';
require __DIR__.'/notifications.php';
require __DIR__.'/google.php';
require __DIR__.'/organization.php';
require __DIR__.'/workspaces.php';
require __DIR__.'/drive.php';
require __DIR__.'/dashboard.php';
require __DIR__.'/hr.php';
require __DIR__.'/planner.php';
require __DIR__.'/reports.php';
require __DIR__.'/announcements.php';
require __DIR__.'/briefings.php';
require __DIR__.'/prototype.php';
require __DIR__.'/chat.php';
require __DIR__.'/roles.php';
require __DIR__.'/okr.php';
require __DIR__.'/automation.php';
require __DIR__.'/notes.php';
require __DIR__.'/meetings.php';
require __DIR__.'/notulen.php';
require __DIR__.'/hiring.php';
require __DIR__.'/management.php';
require __DIR__.'/projects.php';
require __DIR__.'/privacy.php';
require __DIR__.'/android.php';
require __DIR__.'/docs.php';
require __DIR__.'/dev.php';
