<?php

namespace App\Providers;

use App\Domain\Attendance\Models\Kiosk;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;

/**
 * Attendance wiring that is not a container binding of AppServiceProvider.
 */
class AttendanceServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // User provider of the `kiosk` guard (config/auth.php, Sprint 3).
        Auth::provider('kiosk-devices', fn (Application $app): EloquentUserProvider => new EloquentUserProvider($app->make(Hasher::class), Kiosk::class));
    }
}
