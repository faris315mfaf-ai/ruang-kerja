<?php

namespace App\Domain\Organization\Demo;

use App\Models\Company;

/**
 * The single demo company (local/testing). Demo accounts use the `demo.test` domain.
 */
final class DemoCompany
{
    public const string GOOGLE_DOMAIN = 'demo.test';

    public const string FALLBACK_NAME = 'PT Sistem Pelayanan Kesehatan dan Data';

    /**
     * Company name from branding config, unless it is still the "[Nama Perusahaan]" placeholder.
     */
    public static function name(): string
    {
        $name = config('branding.company_name');

        return is_string($name) && trim($name) !== '' && ! str_starts_with(trim($name), '[')
            ? trim($name)
            : self::FALLBACK_NAME;
    }

    /**
     * Idempotent: finds the demo company by its Google domain or creates it.
     */
    public static function ensure(): Company
    {
        $company = Company::query()->firstOrNew(['google_domain' => self::GOOGLE_DOMAIN]);

        $company->fill([
            'name' => self::name(),
            'timezone' => config()->string('app.office_timezone', 'Asia/Jakarta'),
        ]);

        if (! $company->exists) {
            $company->settings = [];
        }

        $company->save();

        return $company;
    }
}
