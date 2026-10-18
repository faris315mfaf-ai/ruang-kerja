<?php

namespace App\Providers;

use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Support\OfficeTimezone;
use App\Models\Company;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;

/**
 * Fase 1 multi-perusahaan: CompanyContext per request/job, and the capture
 * half of CompanyAware (docs/sesi/fase1.md).
 */
class TenancyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Scoped: reset for every HTTP request and every queue job.
        $this->app->scoped(CompanyContext::class);
    }

    public function boot(): void
    {
        // Every office date of a company is computed in its timezone (Langkah 2b).
        Company::saving(fn (Company $company) => OfficeTimezone::assertValid($company->timezone));

        // Runs right before a queued job is serialized (Queue::createObjectPayload):
        // the job/notification remembers its company (CompanyAware::captureCompany).
        Queue::createPayloadUsing(function (?string $connection, ?string $queue, array $payload): array {
            $command = $payload['data']['command'] ?? null;

            if ($command instanceof SendQueuedNotifications) {
                $notification = $command->notification;

                if (method_exists($notification, 'captureCompany')) {
                    $notification->captureCompany($command->notifiables);
                }

                return [];
            }

            if (is_object($command) && method_exists($command, 'captureCompany')) {
                $command->captureCompany();
            }

            return [];
        });
    }
}
