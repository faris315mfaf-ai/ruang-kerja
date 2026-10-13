<?php

use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Enums\AttendanceMethod;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Services\QrCodeService;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Symfony\Component\HttpFoundation\Response;
use Tests\Support\AttendanceFixtures as F;

/*
| API v1 — Bagian 2 / B2-A Absensi: check-in/out QR, flag mock_location,
| `state` eksplisit di hari-ini, riwayat diperkaya, detail hari, rekap bulanan
| dan PDF pribadi. Semua berjalan dengan token Sanctum perangkat.
*/

if (! defined('HASH_PONSEL_B2A')) {
    define('HASH_PONSEL_B2A', 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd');
}

function mbToken(User $user): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => substr(HASH_PONSEL_B2A, 0, 64), 'name' => 'Pixel 8'],
    ])->json('token');

    assert(is_string($token) && $token !== '');

    return $token;
}

/**
 * @param  array<string, mixed>  $fields
 * @return TestResponse<Response>
 */
function mbGps(string $token, array $fields = [], string $type = 'in'): TestResponse
{
    return test()->withToken($token)->withHeader('Accept', 'application/json')
        ->post("/api/v1/absensi/check-{$type}", [
            'latitude' => F::OFFICE_LAT + 0.0003,
            'longitude' => F::OFFICE_LNG,
            'accuracy' => 12,
            'client_time' => now()->toIso8601String(),
            'selfie' => F::selfie(),
            ...$fields,
        ]);
}

/**
 * @param  array<string, mixed>  $fields
 * @return TestResponse<Response>
 */
function mbQr(string $token, string $payload, array $fields = [], string $type = 'in'): TestResponse
{
    return test()->withToken($token)->postJson("/api/v1/absensi/check-{$type}/qr", array_filter([
        'payload' => $payload,
        'latitude' => F::OFFICE_LAT + 0.0003,
        'longitude' => F::OFFICE_LNG,
        'accuracy' => 12,
        'client_time' => now()->toIso8601String(),
        ...$fields,
    ], fn (mixed $value): bool => $value !== null));
}

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
});

// --- QR ---------------------------------------------------------------

test('QR check-in and check-out via the API reuse the web actions with method qr', function () {
    $kiosk = Kiosk::factory()->at($this->office)->paired()->create(['name' => 'Lobi', 'code' => 'KP-LOBI']);
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));
    $token = mbToken($user);
    $payload = app(QrCodeService::class)->issue($kiosk, now())->payload;

    mbQr($token, $payload, ['code' => null])
        ->assertCreated()
        ->assertJsonPath('result.type', 'check_in')
        ->assertJsonPath('result.method', 'qr')
        ->assertJsonPath('result.methodLabel', 'QR kiosk')
        ->assertJsonPath('result.status', 'present')
        ->assertJsonPath('result.location.name', 'Kantor Pusat')
        ->assertJsonPath('result.selfieUrl', null);

    $in = AttendanceLog::query()->sole();
    expect($in->method)->toBe(AttendanceMethod::Qr)
        ->and($in->device_fingerprint)->toBe(HASH_PONSEL_B2A)
        ->and($in->flags->all())->toBe([]);

    $this->travelTo(F::at('2026-10-05 17:30:00'));
    mbQr($token, app(QrCodeService::class)->issue($kiosk, now())->payload, [], 'out')
        ->assertCreated()
        ->assertJsonPath('result.type', 'check_out')
        ->assertJsonPath('result.method', 'qr');

    expect(AttendanceDay::query()->sole()->check_out_at)->not->toBeNull();
});

test('QR endpoints accept `code` as the scanned text and map refusals to the web body', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));
    $token = mbToken($user);

    $this->withToken($token)->postJson('/api/v1/absensi/check-in/qr', ['code' => 'bukan-kode-kiosk'])
        ->assertStatus(422)
        ->assertJsonPath('reason', 'qr_invalid')
        ->assertJsonPath('message', 'Kode QR tidak dikenali. Pindai kode yang tampil di layar kiosk RuangKerja.');

    $this->withToken($token)->postJson('/api/v1/absensi/check-in/qr', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['payload']);

    $this->withToken($token)->postJson('/api/v1/absensi/check-out/qr', ['payload' => 'x'])
        ->assertStatus(422);
});

test('QR check-in without consent is refused with consent_required', function () {
    $kiosk = Kiosk::factory()->at($this->office)->paired()->create();
    $user = F::employee(consent: false);
    $this->travelTo(F::at('2026-10-05 07:52:00'));

    mbQr(mbToken($user), app(QrCodeService::class)->issue($kiosk, now())->payload)
        ->assertStatus(422)->assertJsonPath('reason', 'consent_required');
});

test('QR endpoints need a token', function () {
    $this->postJson('/api/v1/absensi/check-in/qr', ['payload' => 'x'])->assertUnauthorized();
    $this->getJson('/api/v1/absensi/hari/2026-10-05')->assertUnauthorized();
    $this->getJson('/api/v1/absensi/rekap')->assertUnauthorized();
});

// --- mock_location ----------------------------------------------------

test('mock_location flags the GPS check-in for review without blocking it', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));
    $token = mbToken($user);

    mbGps($token, ['mock_location' => 'true'])
        ->assertCreated()
        ->assertJsonPath('result.isSuspicious', true);

    $log = AttendanceLog::query()->sole();
    expect($log->flags->all())->toBe([LogFlag::MockLocation])
        ->and($log->is_suspicious)->toBeTrue()
        ->and(AttendanceDay::query()->sole()->is_suspicious)->toBeTrue()
        ->and(LogFlag::MockLocation->label())->toBe('Lokasi palsu terdeteksi di perangkat');

    $this->travelTo(F::at('2026-10-05 17:30:00'));
    mbGps($token, ['mock_location' => '0'], 'out')->assertCreated();
    expect(AttendanceLog::query()->where('type', 'check_out')->sole()->flags->all())->toBe([]);
});

test('mock_location on a QR check-in is flagged too and an invalid value is rejected', function () {
    $kiosk = Kiosk::factory()->at($this->office)->paired()->create();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));
    $token = mbToken($user);

    mbQr($token, 'x', ['mock_location' => 'mungkin'])->assertStatus(422)->assertJsonValidationErrors(['mock_location']);

    mbQr($token, app(QrCodeService::class)->issue($kiosk, now())->payload, ['mock_location' => true])->assertCreated();

    expect(AttendanceLog::query()->sole()->flags->all())->toBe([LogFlag::MockLocation]);
});

test('client_time far from the server clock raises clock_skew on the API check-in', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52:00'));

    mbGps(mbToken($user), ['client_time' => F::at('2026-10-05 07:30:00')->toIso8601String()])->assertCreated();

    expect(AttendanceLog::query()->sole()->flags->all())->toBe([LogFlag::ClockSkew]);
});

// --- hari-ini state ----------------------------------------------------

function mbState(string $token): array
{
    return test()->withToken($token)->getJson('/api/v1/absensi/hari-ini')->assertOk()->json('state');
}

test('state: not checked in, check-in window not open yet, and the centre button follows the day', function () {
    $user = F::employee();
    $token = mbToken($user);

    $this->travelTo(F::at('2026-10-05 05:30'));
    $state = mbState($token);
    expect($state['code'])->toBe('too_early')
        ->and($state['canCheckIn'])->toBeFalse()
        ->and($state['windowOpensAt'])->toBe('2026-10-04T23:00:00Z')
        ->and($state['message'])->toBe('Check-in dibuka pukul 06.00.')
        ->and($state['center'])->toBe(['action' => 'absen', 'badge' => false, 'flipsAt' => null]);

    $this->travelTo(F::at('2026-10-05 07:30'));
    $state = mbState($token);
    expect($state['code'])->toBe('not_checked_in')
        ->and($state['canCheckIn'])->toBeTrue()
        ->and($state['canCheckOut'])->toBeFalse()
        ->and($state['punctuality'])->toBeNull()
        ->and($state['officeDate'])->toBe('2026-10-05')
        ->and($state['scheduledEnd'])->toBe('2026-10-05T10:00:00Z')
        ->and($state['lateThreshold'])->toBe('2026-10-05T01:10:00Z')
        ->and($state['message'])->toBe('Check-in sebelum 08.10 agar tepat waktu.')
        ->and($state['consent'])->toMatchArray(['granted' => true, 'needsRenewal' => false]);
});

test('state: checked in on time then late, centre flips 60 minutes before the end, then checked out', function () {
    $user = F::employee();
    $token = mbToken($user);

    $this->travelTo(F::at('2026-10-05 07:52'));
    mbGps($token)->assertCreated();

    $state = mbState($token);
    expect($state['code'])->toBe('checked_in')
        ->and($state['punctuality'])->toBe('on_time')
        ->and($state['checkedInAt'])->toBe('2026-10-05T00:52:00Z')
        ->and($state['checkedOutAt'])->toBeNull()
        ->and($state['canCheckOut'])->toBeTrue()
        ->and($state['locationName'])->toBe('Kantor Pusat')
        ->and($state['center'])->toBe(['action' => 'workspace', 'badge' => false, 'flipsAt' => '2026-10-05T09:00:00Z']);

    $this->travelTo(F::at('2026-10-05 16:10'));
    expect(mbState($token)['center'])->toBe(['action' => 'absen', 'badge' => true, 'flipsAt' => null]);

    $this->travelTo(F::at('2026-10-05 17:05'));
    mbGps($token, type: 'out')->assertCreated();
    $state = mbState($token);
    expect($state['code'])->toBe('checked_out')
        ->and($state['checkedOutAt'])->toBe('2026-10-05T10:05:00Z')
        ->and($state['center']['action'])->toBe('workspace');

    $late = F::employee();
    $this->travelTo(F::at('2026-10-06 08:22'));
    $lateToken = mbToken($late);
    mbGps($lateToken)->assertCreated();
    $state = mbState($lateToken);
    expect($state['code'])->toBe('checked_in')
        ->and($state['punctuality'])->toBe('late')
        ->and($state['lateMinutes'])->toBe(12)
        ->and($state['message'])->toContain('terlambat 12 menit');
});

test('state: holiday, weekend and a full-day request are named explicitly', function () {
    Holiday::factory()->on('2026-10-06', 'Hari Libur Uji')->create();
    $user = F::employee();
    $token = mbToken($user);

    $this->travelTo(F::at('2026-10-06 09:00'));
    $state = mbState($token);
    expect($state['code'])->toBe('holiday')
        ->and($state['holidayName'])->toBe('Hari Libur Uji')
        ->and($state['isWorkday'])->toBeFalse();

    $this->travelTo(F::at('2026-10-10 09:00'));
    expect(mbState($token)['code'])->toBe('non_working_day');

    AttendanceDay::factory()->for($user)->on('2026-10-07')->status(AttendanceStatus::Leave)->create();
    $this->travelTo(F::at('2026-10-07 09:00'));
    $state = mbState($token);
    expect($state['code'])->toBe('day_has_request')
        ->and($state['canCheckIn'])->toBeFalse()
        ->and($state['request'])->toMatchArray(['status' => 'leave', 'statusLabel' => 'Cuti', 'blocksCheckIn' => true])
        ->and($state['center']['action'])->toBe('workspace');
});

test('state: a business trip keeps check-in open and is remote, no office location is named', function () {
    $user = F::employee();
    $token = mbToken($user);
    AttendanceDay::factory()->for($user)->on('2026-10-07')->status(AttendanceStatus::BusinessTrip)->create();

    $this->travelTo(F::at('2026-10-07 07:45'));
    $state = mbState($token);
    expect($state['code'])->toBe('not_checked_in')
        ->and($state['isBusinessTrip'])->toBeTrue()
        ->and($state['isRemote'])->toBeTrue()
        ->and($state['request']['blocksCheckIn'])->toBeFalse();

    OfficeLocation::query()->delete();
    $this->travelTo(F::at('2026-10-08 07:45'));
    $state = mbState($token);
    expect($state['code'])->toBe('no_office_location')
        ->and($state['canCheckIn'])->toBeFalse();
});

test('state: consent that is missing or older than the policy is reported', function () {
    $user = F::employee(consent: false);
    $this->travelTo(F::at('2026-10-05 07:30'));

    expect(mbState(mbToken($user))['consent'])->toMatchArray(['granted' => false, 'needsRenewal' => false]);

    app(GiveAttendanceConsent::class)->handle($user);
    config(['attendance.consent.version' => '9.9']);

    expect(mbState(mbToken($user))['consent'])->toMatchArray(['granted' => false, 'needsRenewal' => true, 'version' => '9.9']);
});

test('hari-ini keeps its legacy fields next to the new state', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:30'));

    $this->withToken(mbToken($user))->getJson('/api/v1/absensi/hari-ini')
        ->assertOk()
        ->assertJsonStructure(['today' => ['action', 'schedule' => ['workDate', 'checkInOpensAt', 'allowsRemote'], 'day', 'locations'], 'serverTime', 'state' => ['code', 'center']]);
});

// --- riwayat, hari, rekap ---------------------------------------------

function mbKor(int $days = 7): LeaveType
{
    return LeaveType::factory()->category(RequestCategory::Correction)->withoutQuota()->create(['code' => 'KOR', 'name' => 'Koreksi absensi', 'max_backdate_days' => $days]);
}

test('riwayat cells carry the work plan, flags, request and the correction entry', function () {
    $kor = mbKor();
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    $token = mbToken($user);
    mbGps($token, ['work_plan' => ['Selesaikan laporan', 'Rapat klien'], 'mock_location' => '1'])->assertCreated();

    $this->travelTo(F::at('2026-10-07 09:00'));
    AttendanceDay::factory()->for($user)->on('2026-10-06')->status(AttendanceStatus::Sick)->create();
    EmployeeRequest::factory()->for($user)->create([
        'leave_type_id' => $kor->id, 'status' => RequestStatus::Pending, 'number' => 'KOR-2026-10-0001',
        'start_at' => F::at('2026-10-05 00:00')->utc(), 'end_at' => F::at('2026-10-05 23:59')->utc(),
        'payload' => ['date' => '2026-10-05', 'check_out' => '17:10'],
    ]);

    $json = $this->withToken($token)->getJson('/api/v1/absensi/riwayat?bulan=2026-10')->assertOk()
        ->assertJsonPath('period.month', '2026-10')
        ->assertJsonPath('today', '2026-10-07')
        ->assertJsonPath('correction.available', true)
        ->assertJsonPath('correction.typeCode', 'KOR')
        ->assertJsonPath('correction.maxBackdateDays', 7)
        ->assertJsonPath('recap.presentDays', 1)
        ->json();

    $cells = collect($json['recap']['days'])->keyBy('date');
    $monday = $cells['2026-10-05'];
    expect($monday['status'])->toBe('present')
        ->and($monday['workPlan'])->toBe(['Selesaikan laporan', 'Rapat klien'])
        ->and($monday['checkInAt'])->toBe('2026-10-05T00:52:00Z')
        ->and($monday['locationLabel'])->toBe('Kantor Pusat')
        ->and($monday['flags'])->toBe([['code' => 'mock_location', 'label' => 'Lokasi palsu terdeteksi di perangkat']])
        ->and($monday['correction']['canCorrect'])->toBeFalse() // an open correction request already exists
        ->and($monday['correction']['pendingRequest']['number'])->toBe('KOR-2026-10-0001')
        ->and($monday['correction']['deadline'])->toBe('2026-10-12')
        ->and($monday['isCorrected'])->toBeFalse();

    $tuesday = $cells['2026-10-06'];
    expect($tuesday['status'])->toBe('sick')
        ->and($tuesday['correction']['canCorrect'])->toBeTrue()
        ->and($tuesday['flags'])->toBe([])
        ->and($tuesday['workPlan'])->toBe([]);

    // Legacy keys of the web recap cell are untouched.
    expect($monday)->toHaveKeys(['date', 'kind', 'isWorkday', 'dayId', 'statusLabel', 'lateMinutes', 'workMinutes', 'isSuspicious', 'checkIn', 'checkOut']);
    // Outside the 7-day window and in the future nothing can be corrected.
    expect($cells['2026-10-20']['correction']['canCorrect'])->toBeFalse();
});

test('riwayat links an approved request to the day', function () {
    $user = F::employee();
    $type = LeaveType::factory()->category(RequestCategory::Permit)->create(['code' => 'IZN', 'name' => 'Izin']);
    $request = EmployeeRequest::factory()->for($user)->create([
        'leave_type_id' => $type->id, 'status' => RequestStatus::Approved, 'number' => 'IZN-2026-10-0007',
        'start_at' => F::at('2026-10-06 00:00')->utc(), 'end_at' => F::at('2026-10-06 23:59')->utc(),
    ]);
    AttendanceDay::factory()->for($user)->on('2026-10-06')->status(AttendanceStatus::Permit)->create(['request_id' => $request->id]);
    $this->travelTo(F::at('2026-10-07 09:00'));

    $cell = collect($this->withToken(mbToken($user))->getJson('/api/v1/absensi/riwayat?bulan=2026-10')->assertOk()->json('recap.days'))->firstWhere('date', '2026-10-06');

    expect($cell['request'])->toMatchArray([
        'id' => $request->id, 'number' => 'IZN-2026-10-0007', 'type' => 'Izin', 'category' => 'permit', 'status' => 'approved', 'statusLabel' => 'Disetujui',
    ]);
});

test('riwayat reports no correction entry when the company has no unlocked KOR type', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-07 09:00'));

    $this->withToken(mbToken($user))->getJson('/api/v1/absensi/riwayat?bulan=2026-10')
        ->assertOk()
        ->assertJsonPath('correction.available', false)
        ->assertJsonPath('correction.typeId', null);

    mbKor()->update(['locked_reason' => 'Dikunci']);
    $this->withToken(mbToken($user))->getJson('/api/v1/absensi/riwayat?bulan=2026-10')->assertJsonPath('correction.available', false);
});

test('hari/{date} returns the own day detail with every log, no selfie and the correction window', function () {
    mbKor(3);
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 08:22'));
    $token = mbToken($user);
    mbGps($token, ['work_plan' => ['Satu'], 'note' => 'Macet di tol'])->assertCreated();
    $this->travelTo(F::at('2026-10-05 17:30'));
    mbGps($token, type: 'out')->assertCreated();

    $this->travelTo(F::at('2026-10-07 10:00'));
    $response = $this->withToken($token)->getJson('/api/v1/absensi/hari/2026-10-05')->assertOk()
        ->assertJsonPath('date', '2026-10-05')
        ->assertJsonPath('dateLabel', 'Sen, 5 Okt 2026')
        ->assertJsonPath('day.status', 'late')
        ->assertJsonPath('day.lateMinutes', 12)
        ->assertJsonPath('day.workPlan', ['Satu'])
        ->assertJsonPath('day.checkOutAt', '2026-10-05T10:30:00Z')
        ->assertJsonPath('day.correction.canCorrect', true)
        ->assertJsonPath('day.correction.deadline', '2026-10-08')
        ->assertJsonPath('correction.maxBackdateDays', 3)
        ->assertJsonCount(2, 'logs')
        ->assertJsonPath('logs.0.type', 'check_in')
        ->assertJsonPath('logs.0.note', 'Macet di tol')
        ->assertJsonPath('logs.0.locationName', 'Kantor Pusat')
        ->assertJsonPath('logs.1.type', 'check_out');

    // No selfie key (not even a null URL) anywhere in the payload, and no "mencurigakan" wording.
    $keys = collect(Arr::dot(Arr::except($response->json(), ['privacyNote'])))->keys()->implode(' ');
    expect($keys)->not->toContain('elfie')
        ->and(json_encode($response->json(), JSON_THROW_ON_ERROR))->not->toContain('mencurigakan');

    // Past the window: not correctable any more.
    $this->travelTo(F::at('2026-10-12 10:00'));
    $this->withToken($token)->getJson('/api/v1/absensi/hari/2026-10-05')->assertJsonPath('day.correction.canCorrect', false);
});

test('hari/{date} validates the date and only shows the token owner', function () {
    $user = F::employee();
    $other = F::employee();
    $this->travelTo(F::at('2026-10-05 08:05'));
    AttendanceDay::factory()->for($other)->on('2026-10-05')->create(['check_in_at' => now()]);

    $token = mbToken($user);
    $this->withToken($token)->getJson('/api/v1/absensi/hari/05-10-2026')->assertStatus(422)->assertJsonValidationErrors(['date']);
    $this->withToken($token)->getJson('/api/v1/absensi/hari/2026-02-31')->assertStatus(422);

    $this->withToken($token)->getJson('/api/v1/absensi/hari/2026-10-05')->assertOk()
        ->assertJsonPath('day.status', null)
        ->assertJsonPath('day.kind', 'none')
        ->assertJsonCount(0, 'logs');
});

test('rekap returns the monthly totals of the token owner only', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 08:22'));
    $token = mbToken($user);
    mbGps($token)->assertCreated();
    AttendanceDay::query()->where('user_id', $user->id)->update(['overtime_minutes' => 90]);
    AttendanceDay::factory()->for($user)->on('2026-10-02')->status(AttendanceStatus::Absent)->create();

    $this->travelTo(F::at('2026-10-09 18:00'));
    $this->withToken($token)->getJson('/api/v1/absensi/rekap?bulan=2026-10')
        ->assertOk()
        ->assertJsonPath('period.month', '2026-10')
        ->assertJsonPath('recap.workDays', 7)
        ->assertJsonPath('recap.presentDays', 1)
        ->assertJsonPath('recap.lateCount', 1)
        ->assertJsonPath('recap.lateMinutes', 12)
        ->assertJsonPath('recap.absentDays', 1)
        ->assertJsonPath('recap.overtimeMinutes', 90)
        ->assertJsonPath('recap.overtimeHours', 1.5)
        ->assertJsonPath('downloadFormats', ['pdf'])
        ->assertJsonMissingPath('recap.suspiciousDays')
        ->assertJsonMissingPath('recap.userId');

    // A malformed month falls back to the running month, like the web.
    $this->withToken($token)->getJson('/api/v1/absensi/rekap?bulan=oktober')->assertOk()->assertJsonPath('period.month', '2026-10');
});

test('rekap/unduh streams the personal PDF and refuses the formats the web does not have', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-09 18:00'));
    $token = mbToken($user);

    $response = $this->withToken($token)->get('/api/v1/absensi/rekap/unduh?bulan=2026-09&format=pdf');
    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('application/pdf')
        ->and($response->headers->get('content-disposition'))->toContain('rekap-absensi-saya-2026-09.pdf');

    $this->withToken($token)->get('/api/v1/absensi/rekap/unduh?bulan=2026-09')->assertOk();

    $this->withToken($token)->getJson('/api/v1/absensi/rekap/unduh?bulan=2026-09&format=xlsx')
        ->assertStatus(422)->assertJsonValidationErrors(['format']);
});
