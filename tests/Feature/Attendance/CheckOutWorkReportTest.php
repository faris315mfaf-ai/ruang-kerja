<?php

use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Services\QrCodeService;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;
use Tests\Support\AttendanceFixtures as F;

/*
 * "Laporan kerja" at check-out (owner decision 13 Oct 2026): the evening twin
 * of the morning "rencana kerja" — required for the GPS + selfie form (web and
 * API), optional for the QR/kiosk path (no form), stored as a jsonb list on
 * the day and exposed next to workPlan.
 */
if (! defined('HASH_PONSEL_B5A')) {
    define('HASH_PONSEL_B5A', 'efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef');
}

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
});

function wrToken(User $user): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL_B5A, 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * @param  array<string, mixed>  $fields
 * @return TestResponse<Response>
 */
function wrApiCheck(string $token, string $type, array $fields = []): TestResponse
{
    return test()->withToken($token)->withHeader('Accept', 'application/json')
        ->post("/api/v1/absensi/check-{$type}", [
            'latitude' => F::OFFICE_LAT + 0.0003,
            'longitude' => F::OFFICE_LNG,
            'accuracy' => 12,
            'client_time' => now()->toIso8601String(),
            'selfie' => F::selfie(),
            'device_id' => HASH_PONSEL_B5A,
            ...$fields,
        ]);
}

test('the work report is stored on the day and trimmed, blanks dropped', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Rencana pagi']])->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, ['work_report' => ['  Laporan mingguan selesai ', '', '   ', 'Meeting klien']], type: 'out')->assertCreated();

    $day = AttendanceDay::query()->sole();

    expect($day->work_report)->toBe(['Laporan mingguan selesai', 'Meeting klien'])
        ->and($day->work_plan)->toBe(['Rencana pagi']);
});

test('check-out without a work report is refused and the day stays open', function (mixed $report) {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, ['work_report' => $report], type: 'out')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['work_report' => 'Laporan kerja wajib diisi sebelum absen pulang.']);

    expect(AttendanceDay::query()->sole()->check_out_at)->toBeNull()
        ->and(Storage::disk('selfies')->allFiles())->toHaveCount(1); // only the check-in selfie
})->with([
    'missing' => [[]],
    'only blanks' => [['', '   ']],
]);

test('more than 8 points or a point over 300 characters is refused', function (array $report, string $key, string $message) {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, ['work_report' => $report], type: 'out')
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$key => $message]);
})->with([
    'nine points' => [array_fill(0, 9, 'Poin'), 'work_report', 'Maksimal 8 poin laporan kerja.'],
    'long point' => [[str_repeat('a', 301)], 'work_report.0', 'Tiap poin maksimal 300 karakter.'],
]);

test('eight points of 300 characters are accepted', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, ['work_report' => array_fill(0, 8, str_repeat('a', 300))], type: 'out')->assertCreated();

    expect(AttendanceDay::query()->sole()->work_report)->toHaveCount(8);
});

test('a WFH check-out also needs the report', function () {
    $user = F::employee(mode: WorkMode::Wfh);
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['latitude' => F::northOfOffice(5000), 'note' => 'Rumah'])->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, ['latitude' => F::northOfOffice(5000), 'note' => 'Rumah', 'work_report' => []], type: 'out')->assertUnprocessable();
    F::checkIn($user, ['latitude' => F::northOfOffice(5000), 'note' => 'Rumah'], type: 'out')->assertCreated();

    expect(AttendanceDay::query()->sole()->work_report)->toBe(['Menyelesaikan laporan mingguan']);
});

test('the QR check-out stays free of a report', function () {
    $kiosk = Kiosk::factory()->at($this->office)->paired()->create();
    $codes = app(QrCodeService::class);
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));
    F::scanQr($user, $codes->issue($kiosk, now())->payload)->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05:00'));
    F::scanQr($user, $codes->issue($kiosk, now())->payload, type: 'out')->assertCreated();

    expect(AttendanceDay::query()->sole()->work_report)->toBeNull();
});

test('the API check-out requires and stores the report', function () {
    $user = F::employee();
    $token = wrToken($user);
    $this->travelTo(F::at('2026-10-05 07:52'));
    wrApiCheck($token, 'in', ['work_plan' => ['Rencana pagi']])->assertCreated();

    $this->travelTo(F::at('2026-10-05 17:05'));
    wrApiCheck($token, 'out')->assertUnprocessable()
        ->assertJsonValidationErrors(['work_report' => 'Laporan kerja wajib diisi sebelum absen pulang.']);
    wrApiCheck($token, 'out', ['work_report' => ['Satu', 'Dua']])->assertCreated();

    expect(AttendanceDay::query()->sole()->work_report)->toBe(['Satu', 'Dua']);
});

test('the report is exposed as workReport beside workPlan (web page, history, mobile history)', function () {
    $user = F::employee();
    $token = wrToken($user);
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user, ['work_plan' => ['Rencana pagi']])->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:05'));
    F::checkIn($user, ['work_report' => ['Laporan sore']], type: 'out')->assertCreated();

    $this->withToken($token)->getJson('/api/v1/absensi/hari-ini')
        ->assertOk()
        ->assertJsonPath('today.day.workPlan', ['Rencana pagi'])
        ->assertJsonPath('today.day.workReport', ['Laporan sore']);

    $this->withToken($token)->getJson('/api/v1/absensi/hari/2026-10-05')
        ->assertOk()
        ->assertJsonPath('day.workPlan', ['Rencana pagi'])
        ->assertJsonPath('day.workReport', ['Laporan sore']);
});
