<?php

use App\Domain\Attendance\Models\AttendanceDay;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

/*
 * "Rencana kerja hari ini" at check-in (owner decision 8 Oct 2026): stored on
 * the day and copied to the management WhatsApp group
 * (docs/fitur/absensi-whatsapp.md). Optional at the API level so QR/kiosk and
 * the future mobile API keep working; the main check-in form requires it.
 */
beforeEach(function () {
    Storage::fake('selfies');
    Event::fake();
    $this->office = F::office();
});

test('stores the work plan on the attendance day', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => "1) Selesaikan laporan mingguan\n2) Meeting klien 14.00"])->assertCreated();

    $day = AttendanceDay::query()->sole();
    expect($day->work_plan)->toBe("1) Selesaikan laporan mingguan\n2) Meeting klien 14.00");
});

test('trims and drops an empty plan', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => '   '])->assertCreated();

    expect(AttendanceDay::query()->sole()->work_plan)->toBeNull();
});

test('a check-in without a plan still succeeds (QR/kiosk paths)', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user)->assertCreated();

    expect(AttendanceDay::query()->sole()->work_plan)->toBeNull();
});

test('rejects a plan longer than 2000 characters', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => str_repeat('a', 2001)])
        ->assertInvalid(['work_plan']);

    expect(AttendanceDay::query()->count())->toBe(0);
});
