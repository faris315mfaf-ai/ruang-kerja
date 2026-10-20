<?php

namespace App\Providers;

use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Payroll\Models\EmployeeWage;
use App\Domain\Payroll\Models\PayrollPeriod;
use App\Domain\Payroll\Services\PayrollLock;
use App\Policies\PayrollPolicy;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Attendance wiring that is not a container binding of AppServiceProvider,
 * plus the gaji harian module that sits on top of it.
 */
class AttendanceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Lock lookups are memoized for one request / job.
        $this->app->scoped(PayrollLock::class);
    }

    public function boot(): void
    {
        // User provider of the `kiosk` guard (config/auth.php, Sprint 3).
        Auth::provider('kiosk-devices', fn (Application $app): EloquentUserProvider => new EloquentUserProvider($app->make(Hasher::class), Kiosk::class));

        // Gaji harian (keputusan pemilik 20 Okt 2026): one policy for periods and wages.
        Gate::policy(PayrollPeriod::class, PayrollPolicy::class);
        Gate::policy(EmployeeWage::class, PayrollPolicy::class);
    }
}
