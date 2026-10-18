<?php

namespace App\Domain\Tenancy\Concerns;

use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Middleware\RestoreCompanyContext;
use App\Domain\Tenancy\Support\CompanyOf;

/**
 * Queued jobs and notifications remember the company they were created for
 * and run inside it (Fase 1 multi-perusahaan).
 *
 * Capture: TenancyServiceProvider hooks Queue::createPayloadUsing(), which
 * runs right before the job is serialized — the current CompanyContext, else
 * the first model property carrying a company_id (for a notification: its
 * payload models, then the notifiable). Restore: the RestoreCompanyContext
 * job middleware returned by middleware(); for notifications BaseNotification
 * returns it per channel, so delayed (quiet hours) deliveries get it too.
 *
 * A job created without any company (scheduler, console) keeps an empty
 * context while it runs — the behaviour before Fase 1. Running scheduled jobs
 * per company is Langkah 2.
 *
 * A class that also needs its own middleware merges companyMiddleware().
 */
trait CompanyAware
{
    /** Company the job/notification was queued for (null = none). */
    public ?string $tenantCompanyId = null;

    public function captureCompany(?object $fallback = null): void
    {
        if ($this->tenantCompanyId !== null) {
            return;
        }

        $this->tenantCompanyId = app(CompanyContext::class)->id()
            ?? CompanyOf::properties($this)
            ?? ($fallback === null ? null : CompanyOf::value($fallback));
    }

    public function capturedCompanyId(): ?string
    {
        return $this->tenantCompanyId;
    }

    /**
     * @return list<object>
     */
    public function companyMiddleware(): array
    {
        return [new RestoreCompanyContext];
    }

    /**
     * @return list<object>
     */
    public function middleware(): array
    {
        return $this->companyMiddleware();
    }
}
