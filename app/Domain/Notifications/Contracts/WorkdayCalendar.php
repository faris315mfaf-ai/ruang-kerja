<?php

namespace App\Domain\Notifications\Contracts;

use Carbon\CarbonImmutable;

/**
 * Decides whether the daily digest goes out on a given office-local date.
 * Default: weekdays from config notifications.digest.workdays. The Attendance
 * module may bind a holiday-aware implementation.
 *
 * Holidays are per company (Fase 1 multi-perusahaan): $companyId, else the
 * current company context; without either, the date is a workday unless every
 * company is off.
 */
interface WorkdayCalendar
{
    public function isWorkday(CarbonImmutable $date, ?string $companyId = null): bool;
}
