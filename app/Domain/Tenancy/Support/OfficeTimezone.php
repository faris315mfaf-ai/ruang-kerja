<?php

namespace App\Domain\Tenancy\Support;

use App\Models\Company;
use InvalidArgumentException;

/**
 * `companies.timezone` must be an IANA timezone identifier (e.g. Asia/Jakarta,
 * Asia/Makassar, Asia/Jayapura): every office date of the company is computed
 * in it. Checked when a company is saved (TenancyServiceProvider); a value
 * that is still invalid in the database falls back to the app-wide timezone
 * (CompanyContext::timezone()).
 */
final class OfficeTimezone
{
    public const string DEFAULT = 'Asia/Jakarta';

    /** @var array<string, int>|null */
    private static ?array $identifiers = null;

    /**
     * @phpstan-assert-if-true string $timezone
     */
    public static function isValid(mixed $timezone): bool
    {
        self::$identifiers ??= array_flip(timezone_identifiers_list());

        return is_string($timezone) && isset(self::$identifiers[$timezone]);
    }

    /**
     * The timezone of $company, or the app-wide one without a company or for
     * an invalid stored value.
     */
    public static function of(?Company $company): string
    {
        $timezone = $company?->getAttribute('timezone');

        return self::isValid($timezone) ? $timezone : config()->string('app.office_timezone');
    }

    public static function assertValid(mixed $timezone): void
    {
        if (! self::isValid($timezone)) {
            throw new InvalidArgumentException('Zona waktu perusahaan harus berupa zona IANA, mis. Asia/Jakarta.');
        }
    }
}
