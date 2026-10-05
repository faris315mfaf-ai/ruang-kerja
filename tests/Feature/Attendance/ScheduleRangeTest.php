<?php

use App\Domain\Attendance\Data\DaySchedule;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Carbon\CarbonImmutable;
use Tests\Support\AttendanceFixtures as F;

/**
 * @return array<string, mixed>
 */
function scheduleFingerprint(DaySchedule $schedule): array
{
    return [
        'date' => $schedule->workDateString(),
        'shift' => $schedule->shift?->id,
        'start' => $schedule->scheduledStart?->toIso8601String(),
        'end' => $schedule->scheduledEnd?->toIso8601String(),
        'mode' => $schedule->workMode->value,
        'holiday' => $schedule->holiday?->id,
        'override' => $schedule->isOverride,
        'workday' => $schedule->isWorkday(),
    ];
}

test('forRange resolves exactly like forDate for every user and date', function () {
    $regular = Shift::factory()->create(['name' => 'Reguler']);
    $night = Shift::factory()->hours('22:00', '06:00')->create(['name' => 'Malam']);
    $early = Shift::factory()->hours('06:00', '14:00')->create(['name' => 'Pagi']);

    Holiday::factory()->on('2026-09-25', 'Maulid Nabi')->create();
    Holiday::factory()->on('2026-10-01', 'Libur perusahaan')->create();

    // Office Mon–Fri, then a newer pattern from mid-September.
    $a = User::factory()->create();
    ShiftAssignment::factory()->for($a)->for($regular)->between('2026-01-01', '2026-09-14')->create();
    ShiftAssignment::factory()->for($a)->for($early)->weekdays([1, 2, 3, 4, 5, 6])->between('2026-09-15')->create();
    ShiftAssignment::factory()->for($a)->override('2026-09-20', $night)->create();
    ShiftAssignment::factory()->for($a)->override('2026-09-25', $regular)->create();

    // Hybrid: WFH on Fridays, day off override, WFH override.
    $b = User::factory()->workMode(WorkMode::Hybrid)->create();
    ShiftAssignment::factory()->for($b)->for($regular)->weekdays([1, 2, 3, 4])->between('2026-01-01')->create();
    ShiftAssignment::factory()->for($b)->for($regular)->weekdays([5])->workMode(WorkMode::Wfh)->between('2026-01-01')->create();
    ShiftAssignment::factory()->for($b)->override('2026-09-09')->create();
    ShiftAssignment::factory()->for($b)->override('2026-09-10', $regular)->workMode(WorkMode::Wfh)->create();

    // Overlapping patterns on the same weekday (latest valid_from wins), pattern ending mid-range.
    $c = User::factory()->workMode(WorkMode::Field)->create();
    ShiftAssignment::factory()->for($c)->for($regular)->weekdays([1, 3, 5])->between('2026-08-01')->create();
    ShiftAssignment::factory()->for($c)->for($night)->weekdays([3])->between('2026-09-16', '2026-09-30')->create();

    // No schedule at all.
    $d = User::factory()->create();

    $users = collect([$a, $b, $c, $d]);
    $resolver = app(ScheduleResolver::class);
    $range = $resolver->forRange($users, F::at('2026-09-01'), F::at('2026-10-10'));

    foreach ($users as $user) {
        expect($range[$user->id])->toHaveCount(40);

        for ($date = CarbonImmutable::parse('2026-09-01'); $date->lte(CarbonImmutable::parse('2026-10-10')); $date = $date->addDay()) {
            $key = $date->toDateString();
            $single = $resolver->forDate($user, ScheduleResolver::parseDate($key));

            expect(scheduleFingerprint($range[$user->id][$key]))->toBe(scheduleFingerprint($single), "{$user->name} {$key}");
        }
    }
});

test('forRange returns nothing for an empty or inverted range', function () {
    $resolver = app(ScheduleResolver::class);

    expect($resolver->forRange([], F::at('2026-09-01'), F::at('2026-09-30')))->toBe([])
        ->and($resolver->forRange([User::factory()->create()], F::at('2026-09-30'), F::at('2026-09-01')))->toBe([]);
});
