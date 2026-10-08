<?php

use App\Domain\Attendance\Models\AttendanceDay;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AttendanceFixtures as F;

/*
 * "Rencana/Laporan kerja hari ini" as numbered points at check-in (owner
 * decision 9 Oct 2026): stored as a jsonb list on the day and copied to the
 * management WhatsApp group (docs/fitur/absensi-whatsapp.md). Optional at
 * the API level so QR/kiosk and the future mobile API keep working; the
 * main check-in form requires at least one point.
 */
beforeEach(function () {
    Storage::fake('selfies');
    Event::fake();
    $this->office = F::office();
});

test('stores the work plan points on the attendance day', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['Selesaikan laporan mingguan', 'Meeting klien 14.00']])->assertCreated();

    expect(AttendanceDay::query()->sole()->work_plan)->toBe(['Selesaikan laporan mingguan', 'Meeting klien 14.00']);
});

test('drops blank points', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => ['   ', 'Satu-satunya poin', '']])->assertCreated();

    expect(AttendanceDay::query()->sole()->work_plan)->toBe(['Satu-satunya poin']);
});

test('a check-in without a plan still succeeds (QR/kiosk paths)', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user)->assertCreated();

    expect(AttendanceDay::query()->sole()->work_plan)->toBeNull();
});

test('rejects more than 8 points or a point longer than 300 characters', function (array $plan) {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    F::checkIn($user, ['work_plan' => $plan])->assertStatus(422);

    expect(AttendanceDay::query()->count())->toBe(0);
})->with([
    'sembilan poin' => [array_fill(0, 9, 'poin')],
    'poin terlalu panjang' => [['poin', str_repeat('a', 301)]],
]);
