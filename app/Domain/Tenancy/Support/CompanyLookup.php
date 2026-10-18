<?php

namespace App\Domain\Tenancy\Support;

use App\Models\Company;
use Illuminate\Support\Str;

/**
 * Finds a company from what an operator types in an artisan command: its
 * ULID, its Google Workspace domain, or its exact name (case-insensitive,
 * only when unambiguous).
 */
final class CompanyLookup
{
    public static function find(string $reference): ?Company
    {
        $reference = trim($reference);

        if ($reference === '') {
            return null;
        }

        if (Str::isUlid($reference)) {
            $company = Company::query()->find(Str::lower($reference));

            if ($company !== null) {
                return $company;
            }
        }

        $byDomain = Company::query()->where('google_domain', Str::lower($reference))->first();

        if ($byDomain !== null) {
            return $byDomain;
        }

        $byName = Company::query()->whereRaw('lower(name) = ?', [Str::lower($reference)])->limit(2)->get();

        return $byName->count() === 1 ? $byName->first() : null;
    }
}
