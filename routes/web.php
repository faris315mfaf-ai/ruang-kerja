<?php

use App\Http\Controllers\Auth\DemoLoginController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    // Mobile "Menu" tab (also reachable on desktop).
    Route::inertia('menu', 'menu')->name('menu');

    // Shell entries whose modules arrive in later sprints. Each sprint replaces
    // its entry with real routes.
    $upcoming = [
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

require __DIR__.'/auth.php';
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
