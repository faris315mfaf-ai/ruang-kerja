<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Contracts\WorkdayCalendar;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Working-hours window in the office timezone (config notifications.quiet_hours).
 * Outside it, email for users with quiet hours enabled is delayed until the
 * next window start. Days off are the weekdays outside
 * notifications.quiet_hours.workdays and the holidays of the WorkdayCalendar
 * (the Attendance module binds the holiday-aware one).
 */
final class QuietHours
{
    public function __construct(private readonly WorkdayCalendar $calendar) {}

    public function isQuiet(CarbonInterface $at): bool
    {
        $local = $this->local($at);

        if (! $this->isWorkday($local)) {
            return true;
        }

        $time = $local->format('H:i');

        return $time < $this->end() || $time >= $this->start();
    }

    /**
     * Next moment email may be sent (UTC). Returns $at unchanged when not quiet.
     */
    public function nextAllowed(CarbonInterface $at): CarbonImmutable
    {
        $local = $this->local($at);

        if (! $this->isQuiet($local)) {
            return $local->utc();
        }

        [$hour, $minute] = array_map(intval(...), explode(':', $this->end()));
        $candidate = $local->setTime($hour, $minute);

        if ($candidate->lessThanOrEqualTo($local)) {
            $candidate = $candidate->addDay();
        }

        while (! $this->isWorkday($candidate)) {
            $candidate = $candidate->addDay();
        }

        return $candidate->utc();
    }

    private function local(CarbonInterface $at): CarbonImmutable
    {
        return CarbonImmutable::instance($at)->setTimezone((string) config('app.office_timezone'));
    }

    private function isWorkday(CarbonImmutable $local): bool
    {
        /** @var list<int> $workdays */
        $workdays = config('notifications.quiet_hours.workdays', [1, 2, 3, 4, 5]);

        return in_array($local->dayOfWeekIso, $workdays, true)
            && $this->calendar->isWorkday($local->startOfDay());
    }

    private function start(): string
    {
        return (string) config('notifications.quiet_hours.start', '17:30');
    }

    private function end(): string
    {
        return (string) config('notifications.quiet_hours.end', '07:00');
    }
}
