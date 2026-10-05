<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Attendance\Notifications\MissingCheckOutNotification;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Notification;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    Notification::fake();
    $this->close = app(CloseAttendanceDay::class);
});

test('a scheduled employee without check-in becomes absent, idempotently', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-06 00:30'));

    $first = $this->close->handle(F::at('2026-10-05'));
    $second = $this->close->handle(F::at('2026-10-05'));

    $day = AttendanceDay::query()->sole();

    expect($first->absent)->toBe(1)
        ->and($second->changed())->toBe(0)
        ->and($day->user_id)->toBe($user->id)
        ->and($day->status)->toBe(AttendanceStatus::Absent)
        ->and($day->work_date->toDateString())->toBe('2026-10-05')
        ->and($day->shift_id)->not->toBeNull()
        ->and($day->scheduled_start?->equalTo(F::at('2026-10-05 08:00')))->toBeTrue();
});

test('a missing check-out becomes needs_correction and is notified once', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-10-05')->create([
        'check_in_at' => F::at('2026-10-05 07:50')->utc(),
        'scheduled_end' => F::at('2026-10-05 17:00')->utc(),
    ]);
    $this->travelTo(F::at('2026-10-06 00:30'));

    $first = $this->close->handle(F::at('2026-10-05'));
    $second = $this->close->handle(F::at('2026-10-05'));

    expect($first->needsCorrection)->toBe(1)
        ->and($second->changed())->toBe(0)
        ->and(AttendanceDay::query()->sole()->status)->toBe(AttendanceStatus::NeedsCorrection);

    Notification::assertSentToTimes($user, MissingCheckOutNotification::class, 1);
    Notification::assertSentTo($user, MissingCheckOutNotification::class, function (MissingCheckOutNotification $notification) use ($user) {
        $data = $notification->toArray($user);

        return $data['type'] === 'attendance.check_out_reminder'
            && $data['url'] === '/absensi'
            && str_contains((string) $data['body'], 'Sen, 5 Okt 2026');
    });
});

test('a complete day is left untouched', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-10-05')->create([
        'check_in_at' => F::at('2026-10-05 07:50')->utc(),
        'check_out_at' => F::at('2026-10-05 17:05')->utc(),
    ]);
    $this->travelTo(F::at('2026-10-06 00:30'));

    expect($this->close->handle(F::at('2026-10-05'))->changed())->toBe(0)
        ->and(AttendanceDay::query()->sole()->status)->toBe(AttendanceStatus::Present);
});

test('a pattern day on a holiday is recorded as holiday', function () {
    F::employee();
    Holiday::factory()->on('2026-10-05')->create();
    $this->travelTo(F::at('2026-10-06 00:30'));

    expect($this->close->handle(F::at('2026-10-05'))->holiday)->toBe(1)
        ->and(AttendanceDay::query()->sole()->status)->toBe(AttendanceStatus::Holiday);
});

test('unscheduled days produce no rows', function () {
    F::employee();
    User::factory()->create(); // no assignment at all
    $this->travelTo(F::at('2026-10-11 00:30'));

    expect($this->close->handle(F::at('2026-10-10'))->changed())->toBe(0)
        ->and(AttendanceDay::query()->count())->toBe(0);
});

test('days from approved requests are never overridden', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-10-05')->status(AttendanceStatus::Leave)->create();
    $this->travelTo(F::at('2026-10-06 00:30'));

    $this->close->handle(F::at('2026-10-05'));

    expect(AttendanceDay::query()->sole()->status)->toBe(AttendanceStatus::Leave);
});

test('overnight shifts are closed only after their check-out window', function () {
    $user = F::employee(shift: Shift::factory()->night()->create());
    $this->travelTo(F::at('2026-10-06 00:30'));

    $early = $this->close->handle(F::at('2026-10-05'));

    expect($early->deferred)->toBe(1)->and(AttendanceDay::query()->count())->toBe(0);

    $this->travelTo(F::at('2026-10-07 00:30'));
    expect($this->close->handle(F::at('2026-10-05'))->absent)->toBe(1);
});

test('inactive employees and employees who joined later are skipped', function () {
    $shift = Shift::factory()->create();
    $inactive = User::factory()->inactive()->create();
    $newcomer = User::factory()->create(['joined_at' => '2026-10-12']);
    foreach ([$inactive, $newcomer] as $user) {
        ShiftAssignment::factory()->for($user)->for($shift)->between('2026-01-01')->create();
    }
    $this->travelTo(F::at('2026-10-06 00:30'));

    expect($this->close->handle(F::at('2026-10-05'))->changed())->toBe(0);
});

test('system rows follow later schedule changes', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-06 00:30'));
    $this->close->handle(F::at('2026-10-05'));

    // HR turns that date into a day off afterwards.
    ShiftAssignment::factory()->for($user)->override('2026-10-05')->create();

    expect($this->close->handle(F::at('2026-10-05'))->removed)->toBe(1)
        ->and(AttendanceDay::query()->count())->toBe(0);
});

test('the command closes yesterday and the day before by default', function () {
    F::employee();
    $this->travelTo(F::at('2026-10-07 00:30'));

    $this->artisan('attendance:close-day')
        ->expectsOutputToContain('2026-10-05: 1 alpha')
        ->expectsOutputToContain('2026-10-06: 1 alpha')
        ->assertSuccessful();

    $this->artisan('attendance:close-day')->expectsOutputToContain('2026-10-06: 0 alpha')->assertSuccessful();

    expect(AttendanceDay::query()->count())->toBe(2);
});

test('the command accepts a specific date and validates it', function () {
    F::employee();
    $this->travelTo(F::at('2026-10-20 00:30'));

    $this->artisan('attendance:close-day', ['--date' => '2026-10-08'])->expectsOutputToContain('2026-10-08: 1 alpha')->assertSuccessful();
    $this->artisan('attendance:close-day', ['--date' => '2026-02-30'])->assertExitCode(2);
});

test('close-day is scheduled at 00:30 office time and reminders every five minutes', function () {
    $events = collect(app(Schedule::class)->events());

    $close = $events->first(fn ($event) => str_contains((string) $event->command, 'attendance:close-day'));
    $reminders = $events->first(fn ($event) => str_contains((string) $event->description, 'SendCheckInReminders'));

    expect($close?->expression)->toBe('30 0 * * *')
        ->and($close?->timezone)->toBe('Asia/Jakarta')
        ->and($reminders?->expression)->toBe('*/5 * * * *');
});
