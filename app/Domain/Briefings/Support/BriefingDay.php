<?php

namespace App\Domain\Briefings\Support;

use App\Domain\Tenancy\Support\CurrentCompany;
use Carbon\CarbonImmutable;

/**
 * Office dates of briefings (CurrentCompany::timezone()). A briefing is
 * always recorded for "today"; the date is derived server-side, never sent
 * by the client.
 */
final class BriefingDay
{
    public static function today(?CarbonImmutable $now = null): string
    {
        return ($now ?? CarbonImmutable::now())->setTimezone(CurrentCompany::timezone())->toDateString();
    }
}
