<?php

namespace App\Domain\Tenancy\Support;

use App\Models\Company;

/**
 * The company of a single-company installation, for places without a company
 * context (login page, Google sign-in hint). Null as soon as there are several
 * companies: then nothing may assume "the first company" (Fase 1 multi-
 * perusahaan, docs/sesi/fase1.md).
 */
final class SoleCompany
{
    /**
     * @param  list<string>  $columns
     */
    public static function get(array $columns = ['*']): ?Company
    {
        $companies = Company::query()->limit(2)->get($columns);

        return $companies->count() === 1 ? $companies->first() : null;
    }
}
