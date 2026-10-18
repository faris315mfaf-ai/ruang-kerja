<?php

namespace App\Domain\Tenancy\Scheduling;

use App\Domain\Tenancy\CompanyContext;
use App\Models\Company;
use Closure;
use Illuminate\Database\Eloquent\Collection;

/**
 * Background work per company (Fase 1 multi-perusahaan, Langkah 2b).
 *
 * Scheduled jobs and console commands wrap their work in run(): inside a
 * CompanyContext (a job queued for one company, a task of CompanySchedule)
 * the work runs once for that company; without one (scheduler, manual
 * `php artisan …`, a job dispatched from the console) it runs once per
 * company — soft-deleted companies excluded — each inside its own context,
 * so office dates use that company's timezone and notifications remember it.
 *
 * The work itself limits its queries to CurrentCompany::id() (the jobs and
 * actions do so where they read data of every company).
 */
final class ForEachCompany
{
    /**
     * @template TResult
     *
     * @param  Closure(Company): TResult  $work
     * @return list<TResult>
     */
    public static function run(Closure $work): array
    {
        $context = app(CompanyContext::class);

        if ($context->has()) {
            $company = $context->company();

            return $company === null ? [] : [$work($company)];
        }

        $results = [];

        foreach (self::companies() as $company) {
            $results[] = $context->run($company, fn (): mixed => $work($company));
        }

        return $results;
    }

    /**
     * run() for work that counts something (sent reminders, written rows).
     *
     * @param  Closure(Company): int  $work
     */
    public static function sum(Closure $work): int
    {
        return array_sum(self::run($work));
    }

    /**
     * Active (not soft-deleted) companies, in a fixed order.
     *
     * @return Collection<int, Company>
     */
    public static function companies(): Collection
    {
        return Company::query()->orderBy('id')->get();
    }
}
