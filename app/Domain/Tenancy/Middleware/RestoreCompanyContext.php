<?php

namespace App\Domain\Tenancy\Middleware;

use App\Domain\Tenancy\CompanyContext;
use Closure;
use Illuminate\Notifications\SendQueuedNotifications;

/**
 * Job middleware (CompanyAware): runs the job — or the queued notification
 * wrapped in SendQueuedNotifications — inside the company it was queued for,
 * then restores the previous context (sync queue inside a request).
 *
 * Stateless on purpose: notifications serialize it with the queued wrapper.
 */
final class RestoreCompanyContext
{
    public function handle(object $job, Closure $next): mixed
    {
        $holder = $job instanceof SendQueuedNotifications ? $job->notification : $job;
        $companyId = method_exists($holder, 'capturedCompanyId') ? $holder->capturedCompanyId() : null;

        return app(CompanyContext::class)->run(is_string($companyId) ? $companyId : null, fn (): mixed => $next($job));
    }
}
