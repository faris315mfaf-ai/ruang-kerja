<?php

use App\Domain\Analytics\Services\ScheduleSnapshot;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Services\ScheduleResolver;
use App\Models\User;
use Carbon\CarbonImmutable;

it('resolves the same work shifts as ScheduleResolver, in bulk', function () {
    $regular = Shift::factory()->create(['name' => 'Reguler']);
    $night = Shift::factory()->hours('22:00', '06:00')->create(['name' => 'Malam']);
    $newer = Shift::factory()->create(['name' => 'Baru']);

    $weekday = User::factory()->create();
    ShiftAssignment::factory()->create(['user_id' => $weekday->id, 'shift_id' => $regular->id]);
    $weekend = User::factory()->create();
    ShiftAssignment::factory()->weekdays([6, 7])->create(['user_id' => $weekend->id, 'shift_id' => $regular->id]);
    $override = User::factory()->create();
    ShiftAssignment::factory()->create(['user_id' => $override->id, 'shift_id' => $regular->id]);
    ShiftAssignment::factory()->override('2026-10-07', $night)->create(['user_id' => $override->id]);
    $dayOff = User::factory()->create();
    ShiftAssignment::factory()->create(['user_id' => $dayOff->id, 'shift_id' => $regular->id]);
    ShiftAssignment::factory()->override('2026-10-07')->create(['user_id' => $dayOff->id]);
    $latest = User::factory()->create();
    ShiftAssignment::factory()->between('2025-01-01')->create(['user_id' => $latest->id, 'shift_id' => $regular->id]);
    ShiftAssignment::factory()->between('2026-09-01')->create(['user_id' => $latest->id, 'shift_id' => $newer->id]);
    $expired = User::factory()->create();
    ShiftAssignment::factory()->between('2025-01-01', '2026-09-30')->create(['user_id' => $expired->id, 'shift_id' => $regular->id]);
    $none = User::factory()->create();
    $users = collect([$weekday, $weekend, $override, $dayOff, $latest, $expired, $none]);

    foreach (['2026-10-07', '2026-10-10'] as $date) {
        $day = CarbonImmutable::parse($date, 'Asia/Jakarta');
        $snapshot = app(ScheduleSnapshot::class)->workShifts($users, $day);

        foreach ($users as $user) {
            $schedule = app(ScheduleResolver::class)->forDate($user, $day);
            expect($snapshot[$user->id]?->id)->toBe($schedule->isWorkday() ? $schedule->shift?->id : null, "{$date} {$user->id}");
        }
    }

    // A company holiday cancels patterns but not explicit overrides.
    Holiday::factory()->create(['date' => '2026-10-07']);
    $day = CarbonImmutable::parse('2026-10-07', 'Asia/Jakarta');
    $snapshot = app(ScheduleSnapshot::class)->workShifts($users, $day);

    foreach ($users as $user) {
        $schedule = app(ScheduleResolver::class)->forDate($user, $day);
        expect($snapshot[$user->id]?->id)->toBe($schedule->isWorkday() ? $schedule->shift?->id : null);
    }

    expect($snapshot[$weekday->id])->toBeNull()->and($snapshot[$override->id]?->id)->toBe($night->id);
});
