<?php

use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonImmutable;
use Tests\Support\AttendanceFixtures as F;

// 2026-10-05 is a Monday (mockup "today").

beforeEach(function () {
    $this->resolver = app(ScheduleResolver::class);
    $this->shift = Shift::factory()->create(['name' => 'Reguler']);
    $this->user = User::factory()->create();
});

function weekly(User $user, Shift $shift, array $weekdays = [1, 2, 3, 4, 5], string $from = '2026-01-01', ?string $until = null): ShiftAssignment
{
    return ShiftAssignment::factory()->for($user)->for($shift)->weekdays($weekdays)->between($from, $until)->create();
}

test('a weekday of the weekly pattern is a workday with office-local hours stored as UTC', function () {
    weekly($this->user, $this->shift);

    $schedule = $this->resolver->forDate($this->user, F::at('2026-10-05'));

    expect($schedule->isWorkday())->toBeTrue()
        ->and($schedule->workDateString())->toBe('2026-10-05')
        ->and($schedule->shift?->id)->toBe($this->shift->id)
        ->and($schedule->scheduledStart?->toIso8601String())->toBe('2026-10-05T01:00:00+00:00')
        ->and($schedule->scheduledEnd?->toIso8601String())->toBe('2026-10-05T10:00:00+00:00')
        ->and($schedule->isHoliday())->toBeFalse()
        ->and($schedule->isOverride)->toBeFalse()
        ->and($schedule->workMode)->toBe(WorkMode::Office);
});

test('thresholds follow the shift tolerances and check-in window', function () {
    $shift = Shift::factory()->create(['late_tolerance_min' => 15, 'early_leave_tolerance_min' => 5, 'check_in_window_before_min' => 60]);
    weekly($this->user, $shift);

    $schedule = $this->resolver->forDate($this->user, F::at('2026-10-05'));

    expect($schedule->checkInOpensAt()?->equalTo(F::at('2026-10-05 07:00')))->toBeTrue()
        ->and($schedule->lateThreshold()?->equalTo(F::at('2026-10-05 08:15')))->toBeTrue()
        ->and($schedule->earlyLeaveThreshold()?->equalTo(F::at('2026-10-05 16:55')))->toBeTrue();
});

test('days outside the pattern are not scheduled', function () {
    weekly($this->user, $this->shift);

    $saturday = $this->resolver->forDate($this->user, F::at('2026-10-10'));

    expect($saturday->isWorkday())->toBeFalse()
        ->and($saturday->shift)->toBeNull()
        ->and($saturday->scheduledStart)->toBeNull()
        ->and($saturday->checkInOpensAt())->toBeNull()
        ->and($saturday->lateThreshold())->toBeNull();
});

test('sunday is ISO weekday 7', function () {
    weekly($this->user, $this->shift, [7]);

    expect($this->resolver->forDate($this->user, F::at('2026-10-11'))->isWorkday())->toBeTrue()
        ->and($this->resolver->forDate($this->user, F::at('2026-10-12'))->isWorkday())->toBeFalse();
});

test('users without any assignment are not scheduled and keep their work mode', function () {
    $user = User::factory()->workMode(WorkMode::Field)->create();

    $schedule = $this->resolver->forDate($user, F::at('2026-10-05'));

    expect($schedule->isWorkday())->toBeFalse()
        ->and($schedule->workMode)->toBe(WorkMode::Field)
        ->and($schedule->allowsRemoteCheckIn())->toBeTrue();
});

test('the validity period is inclusive on both ends', function () {
    weekly($this->user, $this->shift, from: '2026-10-05', until: '2026-10-09');

    expect($this->resolver->forDate($this->user, F::at('2026-10-02'))->isWorkday())->toBeFalse()
        ->and($this->resolver->forDate($this->user, F::at('2026-10-05'))->isWorkday())->toBeTrue()
        ->and($this->resolver->forDate($this->user, F::at('2026-10-09'))->isWorkday())->toBeTrue()
        ->and($this->resolver->forDate($this->user, F::at('2026-10-12'))->isWorkday())->toBeFalse();
});

test('when patterns overlap the most recent valid_from wins', function () {
    $early = Shift::factory()->hours('07:00', '16:00')->create(['name' => 'Pagi']);
    weekly($this->user, $this->shift, from: '2026-01-01');
    weekly($this->user, $early, from: '2026-10-01');

    expect($this->resolver->forDate($this->user, F::at('2026-09-28'))->shift?->name)->toBe('Reguler')
        ->and($this->resolver->forDate($this->user, F::at('2026-10-05'))->shift?->name)->toBe('Pagi');
});

test('different patterns per weekday, e.g. a hybrid employee working from home on Friday', function () {
    $user = User::factory()->workMode(WorkMode::Hybrid)->create();
    weekly($user, $this->shift, [1, 2, 3, 4]);
    ShiftAssignment::factory()->for($user)->for($this->shift)->weekdays([5])->between('2026-01-01')->workMode(WorkMode::Wfh)->create();

    $thursday = $this->resolver->forDate($user, F::at('2026-10-08'));
    $friday = $this->resolver->forDate($user, F::at('2026-10-09'));

    expect($thursday->workMode)->toBe(WorkMode::Hybrid)
        ->and($thursday->allowsRemoteCheckIn())->toBeFalse()
        ->and($friday->workMode)->toBe(WorkMode::Wfh)
        ->and($friday->allowsRemoteCheckIn())->toBeTrue()
        ->and($friday->isWorkday())->toBeTrue();
});

test('a date override replaces the pattern for that date only', function () {
    weekly($this->user, $this->shift);
    $night = Shift::factory()->night()->create();
    ShiftAssignment::factory()->for($this->user)->override('2026-10-06', $night)->create();

    $tuesday = $this->resolver->forDate($this->user, F::at('2026-10-06'));

    expect($tuesday->isOverride)->toBeTrue()
        ->and($tuesday->shift?->id)->toBe($night->id)
        ->and($this->resolver->forDate($this->user, F::at('2026-10-07'))->shift?->id)->toBe($this->shift->id);
});

test('an override without a shift is a day off', function () {
    weekly($this->user, $this->shift);
    ShiftAssignment::factory()->for($this->user)->override('2026-10-05')->create();

    $schedule = $this->resolver->forDate($this->user, F::at('2026-10-05'));

    expect($schedule->isWorkday())->toBeFalse()
        ->and($schedule->isOverride)->toBeTrue()
        ->and($schedule->shift)->toBeNull();
});

test('an override can switch the work mode, e.g. a WFH day', function () {
    weekly($this->user, $this->shift);
    ShiftAssignment::factory()->for($this->user)->override('2026-10-05', $this->shift)->workMode(WorkMode::Wfh)->create();

    $schedule = $this->resolver->forDate($this->user, F::at('2026-10-05'));

    expect($schedule->workMode)->toBe(WorkMode::Wfh)
        ->and($schedule->isWorkday())->toBeTrue();
});

test('a company holiday is not a workday but remembers the pattern shift', function () {
    weekly($this->user, $this->shift);
    $holiday = Holiday::factory()->on('2026-10-05', 'Libur uji')->create();

    $schedule = $this->resolver->forDate($this->user, F::at('2026-10-05'));

    expect($schedule->isHoliday())->toBeTrue()
        ->and($schedule->isWorkday())->toBeFalse()
        ->and($schedule->holiday?->id)->toBe($holiday->id)
        ->and($schedule->shift?->id)->toBe($this->shift->id)
        ->and($schedule->scheduledStart)->toBeNull();
});

test('holidays of another company are ignored', function () {
    weekly($this->user, $this->shift);
    Holiday::factory()->on('2026-10-05')->create(['company_id' => Company::factory()->create()->id]);

    expect($this->resolver->forDate($this->user, F::at('2026-10-05'))->isWorkday())->toBeTrue();
});

test('an explicit override on a holiday still schedules work', function () {
    weekly($this->user, $this->shift);
    Holiday::factory()->on('2026-10-05')->create();
    ShiftAssignment::factory()->for($this->user)->override('2026-10-05', $this->shift)->create();

    $schedule = $this->resolver->forDate($this->user, F::at('2026-10-05'));

    expect($schedule->isWorkday())->toBeTrue()
        ->and($schedule->isHoliday())->toBeFalse()
        ->and($schedule->holiday)->not->toBeNull();
});

test('a shift crossing midnight ends on the next calendar day', function () {
    $night = Shift::factory()->night()->create();
    weekly($this->user, $night);

    $schedule = $this->resolver->forDate($this->user, F::at('2026-10-05'));

    expect($night->crosses_midnight)->toBeTrue()
        ->and($schedule->scheduledStart?->equalTo(F::at('2026-10-05 22:00')))->toBeTrue()
        ->and($schedule->scheduledEnd?->equalTo(F::at('2026-10-06 06:00')))->toBeTrue();
});

test('an instant during an overnight shift belongs to the date the shift started', function () {
    $night = Shift::factory()->night()->create();
    weekly($this->user, $night);

    expect($this->resolver->at($this->user, F::at('2026-10-06 05:00'))->workDateString())->toBe('2026-10-05')
        ->and($this->resolver->at($this->user, F::at('2026-10-06 06:30'))->workDateString())->toBe('2026-10-06')
        ->and($this->resolver->at($this->user, F::at('2026-10-05 21:00'))->workDateString())->toBe('2026-10-05');
});

test('check-in candidates list the running overnight shift first', function () {
    $night = Shift::factory()->night()->create();
    weekly($this->user, $night);

    $during = $this->resolver->checkInCandidates($this->user, F::at('2026-10-06 01:00'));
    $after = $this->resolver->checkInCandidates($this->user, F::at('2026-10-06 07:00'));

    expect(array_map(fn ($s) => $s->workDateString(), $during))->toBe(['2026-10-05', '2026-10-06'])
        ->and(array_map(fn ($s) => $s->workDateString(), $after))->toBe(['2026-10-06']);
});

test('a day shift of yesterday never captures the early morning', function () {
    weekly($this->user, $this->shift);

    expect($this->resolver->at($this->user, F::at('2026-10-06 01:00'))->workDateString())->toBe('2026-10-06');
});

test('office dates are computed in Asia/Jakarta', function () {
    $instant = CarbonImmutable::parse('2026-10-05 18:30:00', 'UTC');

    expect(ScheduleResolver::officeDate($instant)->toDateString())->toBe('2026-10-06')
        ->and(ScheduleResolver::parseDate('2026-10-05')->toIso8601String())->toBe('2026-10-05T00:00:00+07:00');
});
