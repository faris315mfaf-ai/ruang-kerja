<?php

namespace App\Domain\Attendance\Support;

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Notifications\Support\WeekdayCalendar;
use App\Domain\Tenancy\CompanyContext;
use App\Models\Company;
use Carbon\CarbonImmutable;

/**
 * Workdays for the daily digest and quiet hours (Sprint 8 contract):
 * configured weekdays minus the holidays HR maintains in Admin › Lokasi, shift
 * & hari libur — of one company (Fase 1 multi-perusahaan, docs/sesi/fase1-celah.md
 * C5): the given company, else the current company context. Without a company,
 * the date is a workday unless every company is off, so one company's holiday
 * never cancels another company's working day.
 */
final class HolidayAwareWorkdayCalendar implements WorkdayCalendar
{
    public function __construct(private readonly WeekdayCalendar $weekdays) {}

    public function isWorkday(CarbonImmutable $date, ?string $companyId = null): bool
    {
        if (! $this->weekdays->isWorkday($date)) {
            return false;
        }

        // Resolved per call: the context is scoped to the request or job.
        $companyId ??= app(CompanyContext::class)->id();
        $holidays = Holiday::query()->whereDate('date', $date->toDateString());

        if ($companyId !== null) {
            return ! $holidays->where('company_id', $companyId)->exists();
        }

        $companies = Company::query()->count();

        return $holidays->whereIn('company_id', Company::query()->select('id'))->distinct()->count('company_id') < $companies;
    }
}
