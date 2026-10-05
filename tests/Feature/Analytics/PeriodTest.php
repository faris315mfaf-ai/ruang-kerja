<?php

use App\Domain\Analytics\Data\Period;
use App\Domain\Analytics\Enums\PeriodPreset;
use Carbon\CarbonImmutable;

beforeEach(function () {
    // Monday 5 Oct 2026 01.30 WIB = Sunday 4 Oct 18.30 UTC: the office date must win.
    $this->now = CarbonImmutable::parse('2026-10-04 18:30', 'UTC');
});

function span(Period $period): array
{
    return [$period->startDate(), $period->lastDate()];
}

it('resolves presets in the office timezone', function () {
    expect(span(Period::resolve(PeriodPreset::Week, null, null, $this->now)))->toBe(['2026-10-05', '2026-10-11'])
        ->and(span(Period::resolve(PeriodPreset::Month, null, null, $this->now)))->toBe(['2026-10-01', '2026-10-31'])
        ->and(span(Period::resolve(PeriodPreset::Quarter, null, null, $this->now)))->toBe(['2026-10-01', '2026-12-31'])
        ->and(span(Period::resolve(PeriodPreset::Custom, '2026-09-10', '2026-09-20', $this->now)))->toBe(['2026-09-10', '2026-09-20']);
});

it('falls back to the current month for an invalid custom range', function (?string $from, ?string $to) {
    $period = Period::resolve(PeriodPreset::Custom, $from, $to, $this->now);

    expect($period->preset)->toBe(PeriodPreset::Month)->and(span($period))->toBe(['2026-10-01', '2026-10-31']);
})->with([
    'missing' => [null, '2026-09-01'],
    'reversed' => ['2026-09-20', '2026-09-10'],
    'not a date' => ['2026-02-30', '2026-03-01'],
]);

it('computes the previous period', function () {
    $week = Period::resolve(PeriodPreset::Week, null, null, $this->now);
    $month = Period::resolve(PeriodPreset::Month, null, null, CarbonImmutable::parse('2026-03-31 10:00', 'Asia/Jakarta'));
    $quarter = Period::resolve(PeriodPreset::Quarter, null, null, $this->now);
    $custom = Period::resolve(PeriodPreset::Custom, '2026-09-10', '2026-09-20', $this->now);

    expect(span($week->previous()))->toBe(['2026-09-28', '2026-10-04'])
        ->and(span($month->previous()))->toBe(['2026-02-01', '2026-02-28'])
        ->and(span($quarter->previous()))->toBe(['2026-07-01', '2026-09-30'])
        ->and(span($custom->previous()))->toBe(['2026-08-30', '2026-09-09'])
        ->and($custom->previous()->days())->toBe(11);
});

it('limits a running period to today and empties a future one', function () {
    $now = CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta');
    $week = Period::resolve(PeriodPreset::Week, null, null, $now);

    expect(span($week->toDate($now)))->toBe(['2026-10-05', '2026-10-07'])
        ->and(span($week->previous()->toDate($now)))->toBe(['2026-09-28', '2026-10-04'])
        ->and(Period::custom('2026-11-01', '2026-11-05')?->toDate($now)->isEmpty())->toBeTrue();
});

it('builds the 8-week trend ending with the current week', function () {
    $weeks = Period::weeksEndingAt($this->now);

    expect($weeks)->toHaveCount(8)
        ->and(span($weeks[0]))->toBe(['2026-08-17', '2026-08-23'])
        ->and(span($weeks[7]))->toBe(['2026-10-05', '2026-10-11'])
        ->and($weeks[0]->shortLabel())->toBe('17 Agu');
});

it('labels periods in Indonesian', function () {
    expect(Period::custom('2026-10-05', '2026-10-11')?->label())->toBe('5–11 Okt 2026')
        ->and(Period::custom('2026-09-29', '2026-10-05')?->label())->toBe('29 Sep – 5 Okt 2026')
        ->and(Period::custom('2026-12-28', '2027-01-03')?->label())->toBe('28 Des 2026 – 3 Jan 2027')
        ->and(Period::custom('2026-10-05', '2026-10-05')?->label())->toBe('5 Okt 2026');
});
