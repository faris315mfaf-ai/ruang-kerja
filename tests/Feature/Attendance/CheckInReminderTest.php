<?php

use App\Domain\Attendance\Jobs\SendCheckInReminders;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Notifications\CheckInReminderNotification;
use App\Domain\Attendance\Support\HolidayAwareWorkdayCalendar;
use App\Domain\Notifications\Channels\InAppChannel;
use App\Domain\Notifications\Contracts\WorkdayCalendar;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    Notification::fake();
});

function runReminders(): void
{
    app()->call([new SendCheckInReminders, 'handle']);
}

test('reminds 15 minutes after the start when not checked in, once per day', function () {
    $user = F::employee();

    $this->travelTo(F::at('2026-10-05 08:14'));
    runReminders();
    Notification::assertNothingSent();

    $this->travelTo(F::at('2026-10-05 08:15'));
    runReminders();
    $this->travelTo(F::at('2026-10-05 08:20'));
    runReminders();

    Notification::assertSentToTimes($user, CheckInReminderNotification::class, 1);
    Notification::assertSentTo($user, CheckInReminderNotification::class, function (CheckInReminderNotification $notification) use ($user) {
        $data = $notification->toArray($user);

        return in_array(InAppChannel::class, $notification->via($user), true)
            && $data['type'] === 'attendance.check_in_reminder'
            && $data['body'] === 'Shift Reguler dimulai pukul 08.00. Lakukan check-in sekarang.'
            && $data['url'] === '/absensi';
    });
});

test('employees who already checked in are not reminded', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-10-05')->create(['check_in_at' => F::at('2026-10-05 07:55')->utc()]);
    $this->travelTo(F::at('2026-10-05 08:20'));

    runReminders();

    Notification::assertNothingSent();
});

test('no reminder on holidays, days off or after the shift ended', function () {
    F::employee();
    Holiday::factory()->on('2026-10-05')->create();

    $this->travelTo(F::at('2026-10-05 08:20'));
    runReminders();
    $this->travelTo(F::at('2026-10-10 08:20')); // Saturday
    runReminders();
    $this->travelTo(F::at('2026-10-06 17:30')); // after the end
    runReminders();

    Notification::assertNothingSent();
});

test('night shift reminders follow the shift start', function () {
    $user = F::employee(shift: Shift::factory()->night()->create());

    $this->travelTo(F::at('2026-10-05 22:15'));
    runReminders();

    Notification::assertSentTo($user, CheckInReminderNotification::class, fn ($n) => $n->workDate === '2026-10-05');
});

test('the daily digest calendar skips company holidays', function () {
    Holiday::factory()->on('2026-10-05')->create();
    $calendar = app(WorkdayCalendar::class);

    expect($calendar)->toBeInstanceOf(HolidayAwareWorkdayCalendar::class)
        ->and($calendar->isWorkday(CarbonImmutable::parse('2026-10-05')))->toBeFalse()
        ->and($calendar->isWorkday(CarbonImmutable::parse('2026-10-06')))->toBeTrue()
        ->and($calendar->isWorkday(CarbonImmutable::parse('2026-10-10')))->toBeFalse();
});
