<?php

use App\Domain\Attendance\Actions\CloseAttendanceDay;
use App\Domain\Attendance\Data\AttendanceWindows;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Services\QrCodeService;
use App\Domain\Notifications\Jobs\SendAttendanceWhatsApp;
use App\Domain\Organization\Enums\Role;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpFoundation\Response;
use Tests\Support\AttendanceFixtures as F;

/*
| API v1 — absen offline (aplikasi offline-first, 14 Okt 2026): `offline` +
| `offline_at` (jam perangkat saat tombol ditekan) menggantikan "sekarang" untuk
| tanggal kerja, jadwal, terlambat, jam absen perusahaan dan occurred_at; log
| ditandai `offline` (perlu ditinjau) dan menyimpan received_at. Senin 5 Okt 2026.
*/

if (! defined('HASH_PONSEL_B7')) {
    define('HASH_PONSEL_B7', 'efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef');
}

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
});

function oflToken(User $user): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => substr(HASH_PONSEL_B7, 0, 64), 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * @param  array<string, mixed>  $fields
 * @return TestResponse<Response>
 */
function oflGps(string $token, ?string $offlineAt, array $fields = [], string $type = 'in', array $headers = []): TestResponse
{
    // The `check-in` limiter (6/min) must not bite a test that posts many times.
    Cache::flush();

    return test()->flushHeaders()->withToken($token)->withHeader('Accept', 'application/json')->withHeaders($headers)
        ->post("/api/v1/absensi/check-{$type}", [
            'latitude' => F::OFFICE_LAT + 0.0003,
            'longitude' => F::OFFICE_LNG,
            'accuracy' => 12,
            // The device clock the web/app always sends: "now" at upload time.
            'client_time' => now()->toIso8601String(),
            'selfie' => F::selfie(),
            ...($type === 'in' ? [] : ['work_report' => ['Menyelesaikan laporan mingguan']]),
            ...($offlineAt === null ? [] : ['offline' => 'true', 'offline_at' => $offlineAt]),
            ...$fields,
        ]);
}

/**
 * @param  array<string, mixed>  $windows
 */
function oflWindows(User $user, array $windows): void
{
    $company = Company::query()->findOrFail($user->company_id);
    $company->settings = [AttendanceWindows::KEY => $windows];
    $company->saveQuietly();
}

// --- check-in ---------------------------------------------------------

test('an offline check-in is judged at the device time, flagged for review and keeps the receive time', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 10:00:00'));
    $token = oflToken($user);

    oflGps($token, '2026-10-05T07:55:00+07:00')
        ->assertCreated()
        ->assertJsonPath('result.type', 'check_in')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.lateMinutes', 0)
        ->assertJsonPath('result.isSuspicious', true)
        ->assertJsonPath('result.isOffline', true)
        ->assertJsonPath('result.occurredAt', '2026-10-05T00:55:00Z')
        ->assertJsonPath('result.receivedAt', '2026-10-05T03:00:00Z');

    $log = AttendanceLog::query()->sole();
    $day = AttendanceDay::query()->sole();

    expect($log->occurred_at->equalTo(F::at('2026-10-05 07:55')))->toBeTrue()
        ->and($log->received_at?->equalTo(F::at('2026-10-05 10:00')))->toBeTrue()
        ->and($log->flags->contains(LogFlag::Offline))->toBeTrue()
        // The device/server clock difference is expected, never a second flag.
        ->and($log->flags->contains(LogFlag::ClockSkew))->toBeFalse()
        ->and($log->is_suspicious)->toBeTrue()
        ->and($day->check_in_at?->equalTo(F::at('2026-10-05 07:55')))->toBeTrue()
        ->and($day->is_suspicious)->toBeTrue()
        ->and($day->work_date->toDateString())->toBe('2026-10-05');
});

test('lateness is computed from the device time, not from the upload time', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 11:00:00'));

    oflGps(oflToken($user), '2026-10-05T08:30:00+07:00')
        ->assertCreated()
        ->assertJsonPath('result.status', 'late')
        ->assertJsonPath('result.lateMinutes', 20);

    expect(AttendanceDay::query()->sole()->late_minutes)->toBe(20);
});

test('an offline check-in from a previous day resolves that work date', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-06 09:00:00'));

    oflGps(oflToken($user), '2026-10-05T08:03:00+07:00')->assertCreated()->assertJsonPath('result.workDate', '2026-10-05');

    expect(AttendanceDay::query()->sole()->work_date->toDateString())->toBe('2026-10-05');
});

test('device time rules: required, at most 5 minutes ahead, at most 72 hours old', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 10:00:00'));
    $token = oflToken($user);

    // Missing / without an offset / unparsable.
    foreach ([[], ['offline_at' => ''], ['offline_at' => '2026-10-05T07:55:00'], ['offline_at' => 'kemarin']] as $fields) {
        oflGps($token, null, ['offline' => 'true', ...$fields])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'offline_clock_invalid')
            ->assertJsonPath('message', 'Jam perangkat tidak valid.');
    }

    oflGps($token, '2026-10-05T10:06:00+07:00')
        ->assertStatus(422)
        ->assertJsonPath('reason', 'offline_clock_invalid');

    oflGps($token, '2026-10-02T09:59:00+07:00')
        ->assertStatus(422)
        ->assertJsonPath('reason', 'offline_expired')
        ->assertJsonPath('message', 'Absen offline lebih dari 72 jam tidak bisa disinkronkan; ajukan koreksi absensi.');

    expect(AttendanceLog::query()->count())->toBe(0);

    // 4 minutes ahead of the server is tolerated.
    oflGps($token, '2026-10-05T10:04:00+07:00')->assertCreated();
});

test('exactly inside the 72 hour limit is accepted', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:00:00'));

    // Friday 2 Oct 08:00 = 71 hours before.
    oflGps(oflToken($user), '2026-10-02T08:00:00+07:00')->assertCreated()->assertJsonPath('result.workDate', '2026-10-02');
});

test('the company check-in window is judged at the device time', function () {
    $user = F::employee();
    oflWindows($user, ['check_in' => ['from' => '06:00', 'until' => '12:00'], 'check_out' => ['from' => null, 'until' => null]]);
    $this->travelTo(F::at('2026-10-05 15:00:00'));
    $token = oflToken($user);

    oflGps($token, '2026-10-05T12:30:00+07:00')
        ->assertStatus(422)
        ->assertJsonPath('reason', 'check_in_window');

    // Online at 15.00 is closed as well, an offline press at 11.30 is not.
    oflGps($token, null)->assertStatus(422)->assertJsonPath('reason', 'check_in_window');
    oflGps($token, '2026-10-05T11:30:00+07:00')->assertCreated()->assertJsonPath('result.status', 'late');
});

test('an online check-in is unchanged: offline_at is ignored without offline=true', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));

    oflGps(oflToken($user), null, ['offline_at' => '2026-10-04T07:00:00+07:00'])
        ->assertCreated()
        ->assertJsonPath('result.isOffline', false)
        ->assertJsonPath('result.receivedAt', null)
        ->assertJsonPath('result.isSuspicious', false);

    $log = AttendanceLog::query()->sole();
    expect($log->received_at)->toBeNull()->and($log->flags->all())->toBe([]);
});

test('an offline check-in keeps the other fraud flags (new device, mock location, low accuracy)', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 10:00:00'));
    AttendanceLog::factory()->for($user)->create(['device_fingerprint' => 'perangkat-lain', 'occurred_at' => F::at('2026-10-02 08:00')->utc()]);

    oflGps(oflToken($user), '2026-10-05T08:00:00+07:00', ['mock_location' => 'true', 'accuracy' => 250])->assertCreated();

    $log = AttendanceLog::query()->latest('occurred_at')->first();
    expect($log->flags->contains(LogFlag::Offline))->toBeTrue()
        ->and($log->flags->contains(LogFlag::MockLocation))->toBeTrue()
        ->and($log->flags->contains(LogFlag::LowAccuracy))->toBeTrue()
        ->and($log->flags->contains(LogFlag::NewDevice))->toBeTrue();
});

test('a later offline press of the same device blocks an earlier one of the same type (time travel)', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-07 09:00:00'));
    $token = oflToken($user);

    oflGps($token, '2026-10-06T08:00:00+07:00')->assertCreated();

    oflGps($token, '2026-10-05T08:00:00+07:00')
        ->assertStatus(422)
        ->assertJsonPath('reason', 'offline_clock_invalid');

    expect(AttendanceLog::query()->count())->toBe(1);
});

test('an offline check-in after a real check-in of the same day is already checked in', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:50:00'));
    $token = oflToken($user);
    oflGps($token, null)->assertCreated();

    $this->travelTo(F::at('2026-10-05 10:00:00'));
    oflGps($token, '2026-10-05T07:45:00+07:00')->assertStatus(422)->assertJsonPath('reason', 'already_checked_in');
});

// --- check-out ---------------------------------------------------------

test('an offline check-out is judged at the device time and must follow the check-in', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55:00'));
    $token = oflToken($user);
    oflGps($token, null)->assertCreated();

    $this->travelTo(F::at('2026-10-05 19:00:00'));

    // Before the check-in is impossible.
    oflGps($token, '2026-10-05T07:30:00+07:00', [], 'out')->assertStatus(422)->assertJsonPath('reason', 'offline_clock_invalid');

    oflGps($token, '2026-10-05T17:10:00+07:00', [], 'out')
        ->assertCreated()
        ->assertJsonPath('result.type', 'check_out')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.earlyLeaveMinutes', 0)
        ->assertJsonPath('result.workMinutes', 8 * 60 + 15)
        ->assertJsonPath('result.isOffline', true);

    $day = AttendanceDay::query()->sole();
    $out = AttendanceLog::query()->where('type', 'check_out')->sole();

    expect($day->check_out_at?->equalTo(F::at('2026-10-05 17:10')))->toBeTrue()
        ->and($out->received_at?->equalTo(F::at('2026-10-05 19:00')))->toBeTrue()
        ->and($out->flags->contains(LogFlag::Offline))->toBeTrue()
        ->and($out->is_suspicious)->toBeTrue();
});

test('an offline check-out computes early leave from the device time', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:55:00'));
    $token = oflToken($user);
    oflGps($token, null)->assertCreated();

    $this->travelTo(F::at('2026-10-05 20:00:00'));
    oflGps($token, '2026-10-05T16:00:00+07:00', [], 'out')
        ->assertCreated()
        ->assertJsonPath('result.status', 'early_leave')
        ->assertJsonPath('result.earlyLeaveMinutes', 60);
});

// --- nightly close (00:30) vs late-arriving offline presses ----------------

test('an offline check-in arriving after the nightly close replaces the absent row', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-06 00:30:00'));
    app(CloseAttendanceDay::class)->handle(F::at('2026-10-05'));
    $absent = AttendanceDay::query()->sole();
    expect($absent->status)->toBe(AttendanceStatus::Absent);

    $this->travelTo(F::at('2026-10-06 09:00:00'));
    oflGps(oflToken($user), '2026-10-05T08:05:00+07:00')
        ->assertCreated()
        ->assertJsonPath('result.workDate', '2026-10-05')
        ->assertJsonPath('result.status', 'present');

    $day = AttendanceDay::query()->sole();
    expect($day->id)->toBe($absent->id)
        ->and($day->status)->toBe(AttendanceStatus::Present)
        ->and($day->check_in_at?->equalTo(F::at('2026-10-05 08:05')))->toBeTrue()
        ->and($day->shift_id)->not->toBeNull();
});

test('an offline check-out arriving after the nightly close restores the real status', function (string $checkIn, string $checkOutAt, AttendanceStatus $expected) {
    Notification::fake();
    $user = F::employee();
    $this->travelTo(F::at("2026-10-05 {$checkIn}:00"));
    $token = oflToken($user);
    oflGps($token, null)->assertCreated();

    // Never checked out: the nightly close flags the day.
    $this->travelTo(F::at('2026-10-06 00:30:00'));
    app(CloseAttendanceDay::class)->handle(F::at('2026-10-05'));
    expect(AttendanceDay::query()->sole()->status)->toBe(AttendanceStatus::NeedsCorrection);

    $this->travelTo(F::at('2026-10-06 09:00:00'));
    oflGps($token, "2026-10-05T{$checkOutAt}:00+07:00", [], 'out')->assertCreated()->assertJsonPath('result.status', $expected->value);

    $day = AttendanceDay::query()->sole();
    expect($day->status)->toBe($expected)->and($day->check_out_at?->equalTo(F::at("2026-10-05 {$checkOutAt}")))->toBeTrue();
})->with([
    'on time' => ['07:55', '17:10', AttendanceStatus::Present],
    'late' => ['08:30', '17:10', AttendanceStatus::Late],
    'left early' => ['07:55', '16:00', AttendanceStatus::EarlyLeave],
]);

// --- QR ------------------------------------------------------------------

test('an offline QR scan is verified against the code window of the device time', function () {
    $kiosk = Kiosk::factory()->at($this->office)->paired()->create(['name' => 'Lobi', 'code' => 'KP-LOBI']);
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));
    $token = oflToken($user);
    $payload = app(QrCodeService::class)->issue($kiosk, now())->payload;

    $this->travelTo(F::at('2026-10-05 10:00:00'));

    // Synced two hours later the code is long expired…
    $this->withToken($token)->postJson('/api/v1/absensi/check-in/qr', [
        'payload' => $payload, 'latitude' => F::OFFICE_LAT + 0.0003, 'longitude' => F::OFFICE_LNG, 'accuracy' => 12,
    ])->assertStatus(422)->assertJsonPath('reason', 'qr_expired');

    // …but valid at the moment the employee scanned it.
    $this->withToken($token)->postJson('/api/v1/absensi/check-in/qr', [
        'payload' => $payload, 'latitude' => F::OFFICE_LAT + 0.0003, 'longitude' => F::OFFICE_LNG, 'accuracy' => 12,
        'offline' => true, 'offline_at' => '2026-10-05T07:52:10+07:00',
    ])
        ->assertCreated()
        ->assertJsonPath('result.method', 'qr')
        ->assertJsonPath('result.isOffline', true)
        ->assertJsonPath('result.status', 'present');

    $log = AttendanceLog::query()->sole();
    expect($log->method)->toBe(AttendanceMethod::Qr)
        ->and($log->flags->contains(LogFlag::Offline))->toBeTrue()
        ->and($log->received_at?->equalTo(F::at('2026-10-05 10:00')))->toBeTrue()
        ->and($log->occurred_at->equalTo(F::at('2026-10-05 07:52:10')))->toBeTrue();
});

test('QR codes are kept long enough for the 72 hour offline limit', function () {
    expect(config('attendance.qr.prune_after_days'))->toBeGreaterThanOrEqual(4);
});

// --- idempotency of a synced press ---------------------------------------

test('a retried sync with the same Idempotency-Key replays the result and never doubles the log', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 10:00:00'));
    $token = oflToken($user);
    $headers = ['Idempotency-Key' => 'abs-masuk-0123456789abcdef'];

    $first = oflGps($token, '2026-10-05T07:55:00+07:00', [], 'in', $headers)->assertCreated();
    $second = oflGps($token, '2026-10-05T07:55:00+07:00', [], 'in', $headers)
        ->assertCreated()
        ->assertHeader('Idempotent-Replayed', 'true');

    expect($second->json())->toBe($first->json())
        ->and(AttendanceLog::query()->count())->toBe(1);

    // Without the key the same press is a normal duplicate.
    oflGps($token, '2026-10-05T07:55:00+07:00')->assertStatus(422)->assertJsonPath('reason', 'already_checked_in');
});

// --- HR review ------------------------------------------------------------

test('HR sees the offline flag, its label and the receive time in "Perlu ditinjau"', function () {
    $this->seed(RoleSeeder::class);
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 10:00:00'));
    oflGps(oflToken($user), '2026-10-05T07:55:00+07:00')->assertCreated();

    $hr = User::factory()->withRole(Role::Hr)->create();
    Sanctum::actingAs($hr);

    $this->getJson('/api/v1/absensi/tim/perlu-ditinjau')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('items.0.occurredAt', '2026-10-05T00:55:00Z')
        ->assertJsonPath('items.0.receivedAt', '2026-10-05T03:00:00Z')
        ->assertJsonPath('items.0.flags.0.value', 'offline')
        ->assertJsonPath('items.0.flags.0.label', 'Absen offline');
});

test('the employee sees the offline flag and receive time in the history detail', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 10:00:00'));
    $token = oflToken($user);
    oflGps($token, '2026-10-05T07:55:00+07:00')->assertCreated();

    $day = AttendanceDay::query()->sole();
    $this->withToken($token)->getJson("/api/v1/absensi/hari/{$day->work_date->toDateString()}")
        ->assertOk()
        ->assertJsonPath('logs.0.receivedAt', '2026-10-05T03:00:00Z')
        ->assertJsonPath('logs.0.flags.0.label', 'Absen offline');
});

// --- WhatsApp copy ----------------------------------------------------------

test('the WhatsApp caption of an offline log says when it was synced', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 09:40:00'));
    oflGps(oflToken($user), '2026-10-05T07:55:00+07:00', ['work_plan' => ['Selesaikan laporan']])->assertCreated();

    $day = AttendanceDay::query()->with('user')->sole();
    $log = $day->checkInLog()->with('officeLocation')->sole();
    $caption = SendAttendanceWhatsApp::message($day, $log);
    $lines = explode("\n", $caption);

    $location = array_search(true, array_map(fn (string $line): bool => str_starts_with($line, 'Lokasi: '), $lines), true);

    expect($lines[0])->toBe('🟢 ABSEN MASUK')
        ->and($caption)->toContain('Jam: 07.55')
        ->and($lines[(int) $location + 1])->toBe('⚠️ Absen offline — tersinkron 09.40')
        ->and($caption)->toContain('1. Selesaikan laporan');
});

test('an online log has no offline line in the WhatsApp caption', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));
    oflGps(oflToken($user), null)->assertCreated();

    $day = AttendanceDay::query()->with('user')->sole();
    $caption = SendAttendanceWhatsApp::message($day, $day->checkInLog()->with('officeLocation')->sole());

    expect($caption)->not->toContain('Absen offline');
});
