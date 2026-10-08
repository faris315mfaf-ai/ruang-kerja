<?php

namespace App\Domain\Briefings\Support;

use Carbon\CarbonImmutable;

/**
 * Office dates of briefings (config('app.office_timezone')). A briefing is
 * always recorded for "today"; the date is derived server-side, never sent
 * by the client.
 */
final class BriefingDay
{
    public static function today(?CarbonImmutable $now = null): string
    {
        return ($now ?? CarbonImmutable::now())->setTimezone(config()->string('app.office_timezone'))->toDateString();
    }
}
