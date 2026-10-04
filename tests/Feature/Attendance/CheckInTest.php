<?php

use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
});

/**
 * @param  array<string, mixed>  $fields
 */
function checkIn(User $user, array $fields = [], string $type = 'in'): TestResponse
{
    return test()->actingAs($user)
        ->withHeader('Accept', 'application/json')
        ->post($type === 'in' ? route('attendance.check-in') : route('attendance.check-out'), [
            'latitude' => F::OFFICE_LAT + 0.0003, // ~33 m from the office
            'longitude' => F::OFFICE_LNG,
            'accuracy' => 12,
            'client_time' => now()->toIso8601String(),
            'selfie' => F::selfie(),
            'device_id' => 'device-1',
            ...$fields,
        ]);
}

test('on time: check-in before the start inside the radius', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));

    $response = checkIn($user)->assertCreated();

    $response->assertJsonPath('result.type', 'check_in')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.statusLabel', 'Hadir')
        ->assertJsonPath('result.lateMinutes', 0)
        ->assertJsonPath('result.minutesBeforeStart', 8)
        ->assertJsonPath('result.method', 'gps_selfie')
        ->assertJsonPath('result.location.name', 'Kantor Pusat')
        ->assertJsonPath('result.location.distanceM', 33)
        ->assertJsonPath('result.location.inside', true)
        ->assertJsonPath('result.shift.name', 'Reguler')
        ->assertJsonPath('result.shift.hours', '08.00–17.00')
        ->assertJsonPath('result.workDate', '2026-10-05');

    $day = AttendanceDay::query()->sole();
    $log = AttendanceLog::query()->sole();

    expect($day->status)->toBe(AttendanceStatus::Present)
        ->and($day->work_date->toDateString())->toBe('2026-10-05')
        ->and($day->check_in_at?->equalTo(F::at('2026-10-05 07:52')))->toBeTrue()
        ->and($day->scheduled_start?->equalTo(F::at('2026-10-05 08:00')))->toBeTrue()
        ->and($day->check_in_log_id)->toBe($log->id)
        ->and($log->method)->toBe(AttendanceMethod::GpsSelfie)
        ->and($log->office_location_id)->toBe($this->office->id)
        ->and($log->flags)->toBeEmpty()
        ->and($log->is_suspicious)->toBeFalse()
        ->and($log->ip_address)->toBe('127.0.0.1')
        ->and($log->device_fingerprint)->toBe('device-1');

    Storage::disk('selfies')->assertExists((string) $log->selfie_path);
    expect($log->selfie_path)->toStartWith("2026/10/{$user->id}/");

    Event::assertDispatched(AttendanceRecorded::class, fn (AttendanceRecorded $event) => $event->log->is($log));
});

test('seconds inside the tolerance minute are still on time', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 08:10:59'));

    checkIn($user)->assertCreated()->assertJsonPath('result.status', 'present')->assertJsonPath('result.lateMinutes', 0);
});

test('late beyond the tolerance counts minutes from the tolerance limit', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 08:34'));

    checkIn($user)->assertCreated()
        ->assertJsonPath('result.status', 'late')
        ->assertJsonPath('result.statusLabel', 'Terlambat')
        ->assertJsonPath('result.lateMinutes', 24)
        ->assertJsonPath('result.minutesBeforeStart', null);

    expect(AttendanceDay::query()->sole()->late_minutes)->toBe(24);
});

test('check-in opens only within the window before the start', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 05:30'));

    checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'too_early')
        ->assertJsonPath('message', 'Check-in untuk shift Reguler baru dibuka pukul 06.00.');

    $this->travelTo(F::at('2026-10-05 06:00'));
    checkIn($user)->assertCreated();
});

test('outside the radius an office employee is rejected with a helpful message', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55'));

    checkIn($user, ['latitude' => F::northOfOffice(340), 'accuracy' => 85])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'outside_geofence')
        ->assertJsonPath('message', 'Anda berada 340 m dari Kantor Pusat (batas 100 m). Ajukan dinas luar jika sedang bertugas di luar.')
        ->assertJsonPath('context.distance_m', 340)
        ->assertJsonPath('context.radius_m', 100)
        ->assertJsonPath('context.accuracy_m', 85)
        ->assertJsonPath('context.location.name', 'Kantor Pusat');

    expect(AttendanceDay::query()->count())->toBe(0)
        ->and(Storage::disk('selfies')->allFiles())->toBeEmpty();
    Event::assertNotDispatched(AttendanceRecorded::class);
});

test('outside the radius a WFH employee is accepted as WFH with a note', function () {
    $user = F::employee(WorkMode::Wfh);
    $this->travelTo(F::at('2026-10-05 07:58'));

    checkIn($user, ['latitude' => F::northOfOffice(25_000)])
        ->assertUnprocessable()
        ->assertJsonPath('reason', 'note_required');

    checkIn($user, ['latitude' => F::northOfOffice(25_000), 'note' => 'Rumah, menyusun laporan'])
        ->assertCreated()
        ->assertJsonPath('result.method', 'wfh')
        ->assertJsonPath('result.status', 'wfh')
        ->assertJsonPath('result.statusLabel', 'WFH')
        ->assertJsonPath('result.location.inside', false);

    $log = AttendanceLog::query()->sole();

    expect($log->method)->toBe(AttendanceMethod::Wfh)
        ->and($log->office_location_id)->toBeNull()
        ->and((int) round((float) $log->distance_m))->toBe(25_000)
        ->and($log->note)->toBe('Rumah, menyusun laporan');
});

test('outside the radius a field employee is accepted and counted present', function () {
    $user = F::employee(WorkMode::Field);
    $this->travelTo(F::at('2026-10-05 07:58'));

    checkIn($user, ['latitude' => F::northOfOffice(8_000), 'note' => 'Kunjungan gudang mitra'])
        ->assertCreated()
        ->assertJsonPath('result.method', 'wfh')
        ->assertJsonPath('result.status', 'present');
});

test('a hybrid employee is accepted outside the radius only on a WFH day', function () {
    $user = F::employee(WorkMode::Hybrid);
    $shift = Shift::query()->firstOrFail();
    ShiftAssignment::factory()->for($user)->override('2026-10-06', $shift)->workMode(WorkMode::Wfh)->create();
    $far = ['latitude' => F::northOfOffice(12_000), 'note' => 'WFH sesuai jadwal'];

    $this->travelTo(F::at('2026-10-05 07:58'));
    checkIn($user, $far)->assertUnprocessable()->assertJsonPath('reason', 'outside_geofence');

    $this->travelTo(F::at('2026-10-06 07:58'));
    checkIn($user, $far)->assertCreated()->assertJsonPath('result.status', 'wfh');
});

test('a WFH employee inside the office radius checks in normally', function () {
    $user = F::employee(WorkMode::Wfh);
    $this->travelTo(F::at('2026-10-05 07:58'));

    checkIn($user)->assertCreated()->assertJsonPath('result.method', 'gps_selfie')->assertJsonPath('result.status', 'present');
});

test('a second check-in on the same day is rejected', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 09:00'));
    checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'already_checked_in')
        ->assertJsonPath('message', 'Anda sudah check-in pukul 07.52. Lakukan check-out saat selesai bekerja.');

    expect(AttendanceLog::query()->count())->toBe(1)
        ->and(Storage::disk('selfies')->allFiles())->toHaveCount(1);
});

test('check-in requires consent for the current policy version', function () {
    $user = F::employee(consent: false);
    $this->travelTo(F::at('2026-10-05 07:52'));

    checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'consent_required')
        ->assertJsonPath('context.version', '1.0');

    $this->actingAs($user)->post(route('attendance.consent.store'))->assertRedirect();

    checkIn($user)->assertCreated();
});

test('on a holiday a check-in is recorded without lateness', function () {
    $user = F::employee();
    Holiday::factory()->on('2026-10-05', 'Libur uji')->create();
    $this->travelTo(F::at('2026-10-05 10:30'));

    checkIn($user)->assertCreated()
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.lateMinutes', 0)
        ->assertJsonPath('result.shift', null);

    expect(AttendanceDay::query()->sole()->shift_id)->toBeNull();
});

test('an unscheduled day (weekend) accepts a check-in without lateness', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-10 11:00'));

    checkIn($user)->assertCreated()->assertJsonPath('result.status', 'present')->assertJsonPath('result.lateMinutes', 0);
});

test('night shift: a late check-in after midnight belongs to the previous work date', function () {
    $night = Shift::factory()->night()->create();
    $user = F::employee(shift: $night);
    $this->travelTo(F::at('2026-10-06 00:30'));

    checkIn($user)->assertCreated()
        ->assertJsonPath('result.workDate', '2026-10-05')
        ->assertJsonPath('result.status', 'late')
        ->assertJsonPath('result.lateMinutes', 140);
});

test('night shift: checking in before the start of the overnight shift', function () {
    $night = Shift::factory()->night()->create();
    $user = F::employee(shift: $night);
    $this->travelTo(F::at('2026-10-05 21:55'));

    checkIn($user)->assertCreated()
        ->assertJsonPath('result.workDate', '2026-10-05')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.minutesBeforeStart', 5);
});

test('a shift bound to a location only accepts that geofence', function () {
    $warehouse = OfficeLocation::factory()->at(-6.3, 107.15, 150)->create(['name' => 'Gudang Cikarang']);
    $shift = Shift::factory()->atLocation($warehouse)->create(['name' => 'Gudang Pagi']);
    $user = F::employee(shift: $shift);
    $this->travelTo(F::at('2026-10-05 07:50'));

    checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'outside_geofence')
        ->assertJsonPath('context.location.name', 'Gudang Cikarang');

    checkIn($user, ['latitude' => -6.3, 'longitude' => 107.15])->assertCreated()
        ->assertJsonPath('result.location.name', 'Gudang Cikarang');
});

test('inactive locations are ignored', function () {
    $this->office->update(['is_active' => false]);
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:50'));

    checkIn($user)->assertUnprocessable()->assertJsonPath('reason', 'no_office_location');
});

test('a day already covered by an approved request cannot be checked in', function () {
    $user = F::employee();
    AttendanceDay::factory()->for($user)->on('2026-10-05')->status(AttendanceStatus::Leave)->create();
    $this->travelTo(F::at('2026-10-05 07:50'));

    checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'day_has_request')
        ->assertJsonPath('message', 'Hari ini tercatat Cuti dari pengajuan yang disetujui. Hubungi HR bila Anda tetap masuk kerja.');
});

test('fraud signals flag the log without blocking the check-in', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:50'));

    checkIn($user, ['accuracy' => 150, 'client_time' => now()->subMinutes(9)->toIso8601String()])->assertCreated()
        ->assertJsonPath('result.isSuspicious', true);

    $log = AttendanceLog::query()->sole();

    expect($log->flags->all())->toBe([LogFlag::LowAccuracy, LogFlag::ClockSkew])
        ->and($log->is_suspicious)->toBeTrue()
        ->and(AttendanceDay::query()->sole()->is_suspicious)->toBeTrue();
});

test('input is validated with Indonesian messages', function () {
    $user = F::employee();

    $this->actingAs($user)->postJson(route('attendance.check-in'), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['latitude', 'longitude', 'selfie'])
        ->assertJsonPath('errors.selfie.0', 'Ambil selfie terlebih dulu.');
});

test('guests cannot check in', function () {
    $this->postJson(route('attendance.check-in'))->assertUnauthorized();
});

test('check-in attempts are rate limited per user', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 05:00'));

    foreach (range(1, 6) as $attempt) {
        checkIn($user)->assertUnprocessable();
    }

    checkIn($user)->assertTooManyRequests();
});
