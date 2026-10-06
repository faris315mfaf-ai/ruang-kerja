<?php

namespace App\Providers;

use App\Domain\Automation\Services\AutomationContext;
use App\Domain\Automation\Services\TaskCategoryChanges;
use App\Models\Task;
use App\Policies\PerformancePolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Otomasi & Kinerja saya (F2-4).
 *
 * - Kinerja saya has no model behind it: its ability is the `viewPerformance`
 *   gate backed by PerformancePolicy.
 * - Rule chains: AutomationContext (loop guard) and TaskCategoryChanges
 *   ("pindah ke kategori X") live for one request / queued job.
 * - The listener is discovered (app/Listeners/Automation); the jobs are
 *   scheduled in routes/console.php.
 */
class AutomationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(AutomationContext::class);
        $this->app->scoped(TaskCategoryChanges::class);
    }

    public function boot(): void
    {
        Gate::define('viewPerformance', [PerformancePolicy::class, 'view']);

        Task::updated(function (Task $task): void {
            if ((bool) config('features.automation')) {
                $this->app->make(TaskCategoryChanges::class)->record($task);
            }
        });
    }
}
