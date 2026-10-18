<?php

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use App\Domain\Tenancy\CompanyContext;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;

/*
 * C5 (docs/sesi/fase1-celah.md): a holiday belongs to one company.
 */

it('counts only the holidays of the given or current company', function () {
    $home = Company::query()->findOrFail(User::factory()->create()->company_id);
    $foreign = Company::factory()->foreign()->create();
    Holiday::factory()->create(['company_id' => $foreign->id, 'date' => '2026-10-23']);
    Holiday::factory()->create(['company_id' => $home->id, 'date' => '2026-10-22']);
    $calendar = app(WorkdayCalendar::class);
    $friday = CarbonImmutable::parse('2026-10-23');
    $thursday = CarbonImmutable::parse('2026-10-22');

    expect($calendar->isWorkday($friday, $home->id))->toBeTrue()
        ->and($calendar->isWorkday($friday, $foreign->id))->toBeFalse()
        ->and(app(CompanyContext::class)->run($home, fn () => $calendar->isWorkday($friday)))->toBeTrue()
        ->and(app(CompanyContext::class)->run($foreign, fn () => $calendar->isWorkday($friday)))->toBeFalse()
        // Without a company: a workday unless every company is off.
        ->and($calendar->isWorkday($friday))->toBeTrue()
        ->and($calendar->isWorkday($thursday))->toBeTrue()
        ->and($calendar->isWorkday(CarbonImmutable::parse('2026-10-24')))->toBeFalse();

    Holiday::factory()->create(['company_id' => $foreign->id, 'date' => '2026-10-22']);

    expect($calendar->isWorkday($thursday))->toBeFalse();
});
