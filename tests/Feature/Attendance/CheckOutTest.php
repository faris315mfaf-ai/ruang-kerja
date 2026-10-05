<?php

use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\WorkMode;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    F::office();
});

test('check-out after the scheduled end keeps the status and computes work minutes', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, type: 'out')->assertCreated()
        ->assertJsonPath('result.type', 'check_out')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.earlyLeaveMinutes', 0)
        ->assertJsonPath('result.workMinutes', 493); // 9h13m − 60m break

    $day = AttendanceDay::query()->sole();

    expect($day->check_out_at?->equalTo(F::at('2026-10-05 17:05')))->toBeTrue()
        ->and($day->check_out_log_id)->toBe(AttendanceLog::query()->where('type', 'check_out')->value('id'))
        ->and(AttendanceLog::query()->count())->toBe(2);

    Event::assertDispatchedTimes(AttendanceRecorded::class, 2);
});

test('leaving before the end is early leave', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 16:00'));
    F::checkIn($user, type: 'out')->assertCreated()
        ->assertJsonPath('result.status', 'early_leave')
        ->assertJsonPath('result.statusLabel', 'Pulang cepat')
        ->assertJsonPath('result.earlyLeaveMinutes', 60);
});

test('early leave respects the shift tolerance', function () {
    $shift = Shift::factory()->create(['early_leave_tolerance_min' => 15]);
    $user = F::employee(shift: $shift);
    $this->travelTo(F::at('2026-10-05 07:55'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 16:50'));
    F::checkIn($user, type: 'out')->assertCreated()->assertJsonPath('result.status', 'present')->assertJsonPath('result.earlyLeaveMinutes', 0);
});

test('a late day stays late when leaving early, minutes are still recorded', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 08:30'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 16:30'));
    F::checkIn($user, type: 'out')->assertCreated()
        ->assertJsonPath('result.status', 'late')
        ->assertJsonPath('result.lateMinutes', 20)
        ->assertJsonPath('result.earlyLeaveMinutes', 30);
});

test('a short day does not deduct the break', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 10:55'));
    F::checkIn($user, type: 'out')->assertCreated()->assertJsonPath('result.workMinutes', 180);
});

test('check-out without check-in is rejected', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 17:00'));

    F::checkIn($user, type: 'out')->assertUnprocessable()
        ->assertJsonPath('reason', 'not_checked_in')
        ->assertJsonPath('message', 'Anda belum check-in hari ini. Check-in dulu, atau ajukan koreksi absensi bila lupa.');

    expect(AttendanceLog::query()->count())->toBe(0)
        ->and(Storage::disk('selfies')->allFiles())->toBeEmpty();
});

test('a second check-out is rejected', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55'));
    F::checkIn($user)->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:02'));
    F::checkIn($user, type: 'out')->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:30'));
    F::checkIn($user, type: 'out')->assertUnprocessable()
        ->assertJsonPath('reason', 'already_checked_out')
        ->assertJsonPath('message', 'Anda sudah check-out pukul 17.02. Ajukan koreksi absensi bila jamnya keliru.');
});

test('night shift: check-out the next morning closes the previous work date', function () {
    $user = F::employee(shift: Shift::factory()->night()->create());
    $this->travelTo(F::at('2026-10-05 21:55'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-06 06:05'));
    F::checkIn($user, type: 'out')->assertCreated()
        ->assertJsonPath('result.workDate', '2026-10-05')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.workMinutes', 460); // 8h10m − 30m break

    expect(AttendanceDay::query()->sole()->work_date->toDateString())->toBe('2026-10-05');
});

test('a forgotten check-out cannot be done the next morning', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55'));
    F::checkIn($user)->assertCreated();

    // Window closes at 17.00 + 6 h grace = 23.00.
    $this->travelTo(F::at('2026-10-05 22:59'));
    // still allowed the same evening
    $this->travelTo(F::at('2026-10-06 07:50'));
    F::checkIn($user, type: 'out')->assertUnprocessable()->assertJsonPath('reason', 'not_checked_in');
});

test('overtime check-out late the same evening is accepted', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 22:30'));
    F::checkIn($user, type: 'out')->assertCreated()->assertJsonPath('result.workDate', '2026-10-05');
});

test('check-out follows the same geofence rules', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, ['latitude' => F::northOfOffice(500)], 'out')
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'outside_geofence');

    expect(AttendanceDay::query()->sole()->check_out_at)->toBeNull();
});

test('a WFH employee checks out from home with a note', function () {
    $user = F::employee(WorkMode::Wfh);
    $far = ['latitude' => F::northOfOffice(20_000), 'note' => 'Rumah'];
    $this->travelTo(F::at('2026-10-05 07:55'));
    F::checkIn($user, $far)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:01'));
    F::checkIn($user, $far, 'out')->assertCreated()->assertJsonPath('result.status', 'wfh')->assertJsonPath('result.method', 'wfh');
});

test('check-out also requires consent', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-10-05')->create(['check_in_at' => F::at('2026-10-05 07:55')->utc()]);
    AttendanceConsent::query()->where('user_id', $user->id)->update(['revoked_at' => now()]);
    $this->travelTo(F::at('2026-10-05 17:05'));

    F::checkIn($user, type: 'out')->assertUnprocessable()->assertJsonPath('reason', 'consent_required');

    expect(AttendanceDay::query()->sole()->status)->toBe(AttendanceStatus::Present);
});
