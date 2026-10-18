<?php

namespace App\Domain\Tenancy\Support;

use App\Domain\Tenancy\CompanyContext;

/**
 * Static shortcuts to the current CompanyContext (Fase 1 multi-perusahaan,
 * Langkah 2b), for code that has no container injection at hand: helpers,
 * enums, FormRequests and queries.
 *
 * timezone() is the office timezone of every office date and clock time in
 * the app: the company's `companies.timezone`, or config('app.office_timezone')
 * when there is no company (guest pages, console without a company).
 */
final class CurrentCompany
{
    public static function id(): ?string
    {
        return app(CompanyContext::class)->id();
    }

    public static function timezone(): string
    {
        return app(CompanyContext::class)->timezone();
    }
}
