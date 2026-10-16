<?php

use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Actions\SaveAttendanceWindows;
use App\Domain\Attendance\Data\AttendanceWindows;
use App\Domain\Attendance\Events\AttendanceRecorded;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Services\QrCodeService;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;

/*
 * Company-wide "jam absen" (owner decision 13 Oct 2026): the hours check-in
 * and check-out are accepted, stored in companies.settings.attendance_windows.
 * Office shift in these tests: Mon–Fri 08.00–17.00, check-in window 120 min
 * before the start (opens 06.00).
 */
if (! defined('HASH_PONSEL_B5W')) {
    define('HASH_PONSEL_B5W', 'abababababababababababababababababababababababababababababababab');
}

beforeEach(function () {
    Storage::fake('selfies');
    Event::fake([AttendanceRecorded::class]);
    $this->office = F::office();
});

/**
 * @param  array<string, mixed>  $windows
 */
function jamAbsen(User $user, array $windows): void
{
    $company = Company::query()->findOrFail($user->company_id);
    $company->settings = $windows === [] ? [] : [AttendanceWindows::KEY => $windows];
    $company->saveQuietly();
}

function wToken(User $user): string
{
    $token = test()->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => HASH_PONSEL_B5W, 'name' => 'Pixel 8'],
    ])->json('token');

    return (string) $token;
}

/**
 * @return array<string, mixed>
 */
function wState(string $token): array
{
    return test()->withToken($token)->getJson('/api/v1/absensi/hari-ini')->assertOk()->json();
}

test('check-in is accepted only inside [from, until], boundaries inclusive', function () {
    $user = F::employee();
    jamAbsen($user, ['check_in' => ['from' => '07:00', 'until' => '09:00'], 'check_out' => ['from' => null, 'until' => null]]);

    // The shift alone would open at 06.00: the company "dari jam" replaces it.
    $this->travelTo(F::at('2026-10-05 06:59:59'));
    F::checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'check_in_window')
        ->assertJsonPath('message', 'Absen masuk dibuka pukul 07.00 dan ditutup pukul 09.00.')
        ->assertJsonPath('context.phase', 'before')
        ->assertJsonPath('context.from', '07:00')
        ->assertJsonPath('context.until', '09:00')
        ->assertJsonPath('context.opens_at', '2026-10-05T00:00:00Z');

    $this->travelTo(F::at('2026-10-05 09:01:00'));
    F::checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'check_in_window')
        ->assertJsonPath('context.phase', 'after')
        ->assertJsonPath('context.opens_at', null);

    expect(AttendanceDay::query()->count())->toBe(0)
        ->and(Storage::disk('selfies')->allFiles())->toBeEmpty();

    $this->travelTo(F::at('2026-10-05 09:00:59'));
    F::checkIn($user)->assertCreated();
});

test('the lower bound is inclusive and replaces the shift opening window', function () {
    $user = F::employee();
    jamAbsen($user, ['check_in' => ['from' => '05:00', 'until' => null], 'check_out' => ['from' => null, 'until' => null]]);

    // 05.00 is before the shift opening (06.00) but on the company bound (05.00).
    $this->travelTo(F::at('2026-10-05 05:00:00'));
    F::checkIn($user)->assertCreated();
});

test('an upper bound alone keeps the shift opening window', function () {
    $user = F::employee();
    jamAbsen($user, ['check_in' => ['from' => null, 'until' => '12:00']]);

    $this->travelTo(F::at('2026-10-05 05:30'));
    F::checkIn($user)->assertUnprocessable()->assertJsonPath('reason', 'too_early');

    $this->travelTo(F::at('2026-10-05 12:01'));
    F::checkIn($user)->assertUnprocessable()
        ->assertJsonPath('reason', 'check_in_window')
        ->assertJsonPath('message', 'Absen masuk ditutup pukul 12.00.');

    $this->travelTo(F::at('2026-10-05 12:00:30'));
    F::checkIn($user)->assertCreated();
});

test('check-out is accepted only inside [from, until], boundaries inclusive', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();
    jamAbsen($user, ['check_out' => ['from' => '16:00', 'until' => '18:00']]);

    $this->travelTo(F::at('2026-10-05 15:59:59'));
    F::checkIn($user, type: 'out')->assertUnprocessable()
        ->assertJsonPath('reason', 'check_out_window')
        ->assertJsonPath('message', 'Absen pulang dibuka pukul 16.00 dan ditutup pukul 18.00.')
        ->assertJsonPath('context.phase', 'before');

    $this->travelTo(F::at('2026-10-05 18:01'));
    F::checkIn($user, type: 'out')->assertUnprocessable()
        ->assertJsonPath('reason', 'check_out_window')
        ->assertJsonPath('context.phase', 'after');

    expect(AttendanceDay::query()->sole()->check_out_at)->toBeNull();

    $this->travelTo(F::at('2026-10-05 18:00:59'));
    F::checkIn($user, type: 'out')->assertCreated();
});

test('without windows nothing changes: shift opening applies and check-out is open any time', function () {
    $user = F::employee();

    $this->travelTo(F::at('2026-10-05 05:30'));
    F::checkIn($user)->assertUnprocessable()->assertJsonPath('reason', 'too_early');

    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-05 22:30'));
    F::checkIn($user, type: 'out')->assertCreated();
});

test('an employee without any shift also follows the windows', function () {
    $user = User::factory()->create();
    app(GiveAttendanceConsent::class)->handle($user);
    jamAbsen($user, ['check_in' => ['from' => '06:00', 'until' => '12:00']]);

    $this->travelTo(F::at('2026-10-05 05:59'));
    F::checkIn($user)->assertUnprocessable()->assertJsonPath('reason', 'check_in_window');

    $this->travelTo(F::at('2026-10-05 13:00'));
    F::checkIn($user)->assertUnprocessable()->assertJsonPath('reason', 'check_in_window');

    $this->travelTo(F::at('2026-10-05 09:30'));
    F::checkIn($user)->assertCreated();
});

test('the windows do not apply to a shift crossing midnight', function () {
    $user = F::employee(shift: Shift::factory()->night()->create());
    jamAbsen($user, ['check_in' => ['from' => '08:00', 'until' => '12:00'], 'check_out' => ['from' => '15:00', 'until' => '16:00']]);

    $this->travelTo(F::at('2026-10-05 21:55'));
    F::checkIn($user)->assertCreated();

    $this->travelTo(F::at('2026-10-06 06:05'));
    F::checkIn($user, type: 'out')->assertCreated();
});

test('a day opened yesterday is not held to the check-out window', function () {
    $user = F::employee();
    $this->travelTo(F::at('2026-10-05 07:52'));
    F::checkIn($user)->assertCreated();
    jamAbsen($user, ['check_out' => ['from' => '15:00', 'until' => '18:00']]);

    // 17.00 + 6 h grace: still open at 22.30, and it is today's date → window applies.
    $this->travelTo(F::at('2026-10-05 22:30'));
    F::checkIn($user, type: 'out')->assertUnprocessable()->assertJsonPath('reason', 'check_out_window');

    // Crossing into the next office day with a late open day (overnight / overtime shift data).
    $day = AttendanceDay::query()->sole();
    $day->update(['scheduled_end' => F::at('2026-10-06 03:00')->utc()]);
    $this->travelTo(F::at('2026-10-06 04:00'));
    F::checkIn($user, type: 'out')->assertCreated();
});

test('QR check-in and check-out obey the same windows', function () {
    $kiosk = Kiosk::factory()->at($this->office)->paired()->create();
    $codes = app(QrCodeService::class);
    $user = F::employee();
    jamAbsen($user, ['check_in' => ['from' => '07:00', 'until' => '09:00'], 'check_out' => ['from' => '16:00', 'until' => '18:00']]);

    $this->travelTo(F::at('2026-10-05 06:30:00'));
    F::scanQr($user, $codes->issue($kiosk, now())->payload)->assertUnprocessable()->assertJsonPath('reason', 'check_in_window');

    $this->travelTo(F::at('2026-10-05 07:30:00'));
    F::scanQr($user, $codes->issue($kiosk, now())->payload)->assertCreated();

    $this->travelTo(F::at('2026-10-05 15:30:00'));
    F::scanQr($user, $codes->issue($kiosk, now())->payload, type: 'out')->assertUnprocessable()->assertJsonPath('reason', 'check_out_window');

    $this->travelTo(F::at('2026-10-05 17:00:00'));
    F::scanQr($user, $codes->issue($kiosk, now())->payload, type: 'out')->assertCreated();
});

test('an HR manual correction is never blocked by the windows', function () {
    $this->seed(RoleSeeder::class);
    $hr = User::factory()->withRole(Role::Hr)->create();
    $employee = F::employee();
    jamAbsen($employee, ['check_in' => ['from' => '07:00', 'until' => '09:00'], 'check_out' => ['from' => '16:00', 'until' => '18:00']]);
    $this->travelTo(F::at('2026-10-05 09:15'));

    $this->actingAs($hr)->from(route('attendance.board'))->post(route('attendance.corrections.store'), [
        'user_id' => $employee->id,
        'work_date' => '2026-10-02',
        'check_in' => '10:30',
        'check_out' => '20:45',
        'reason' => 'Lupa absen, dikonfirmasi atasan',
    ])->assertSessionHasNoErrors();

    $day = AttendanceDay::query()->sole();

    expect($day->check_in_at?->equalTo(F::at('2026-10-02 10:30')))->toBeTrue()
        ->and($day->check_out_at?->equalTo(F::at('2026-10-02 20:45')))->toBeTrue();
});

test('the Absensi page exposes the windows and why the next action is closed', function () {
    $user = F::employee();
    jamAbsen($user, ['check_in' => ['from' => '07:00', 'until' => '09:00'], 'check_out' => ['from' => '16:00', 'until' => '18:00']]);

    $this->travelTo(F::at('2026-10-05 06:30'));
    $this->actingAs($user)->get(route('attendance.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('today.windows.checkIn', ['from' => '07:00', 'until' => '09:00'])
            ->where('today.windows.checkOut', ['from' => '16:00', 'until' => '18:00'])
            ->where('today.checkInBlocked.code', 'too_early')
            ->where('today.checkInBlocked.message', 'Absen masuk dibuka pukul 07.00 dan ditutup pukul 09.00.')
            ->where('today.checkOutBlockedReason', null));

    $this->travelTo(F::at('2026-10-05 09:30'));
    $this->actingAs($user)->get(route('attendance.index'))
        ->assertInertia(fn (Assert $page) => $page->where('today.checkInBlocked.code', 'window_closed'));

    $this->travelTo(F::at('2026-10-05 08:00'));
    F::checkIn($user)->assertCreated();
    $this->travelTo(F::at('2026-10-05 12:00'));
    $this->actingAs($user)->get(route('attendance.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('today.checkInBlocked', null)
            ->where('today.checkOutBlockedReason', 'Absen pulang dibuka pukul 16.00 dan ditutup pukul 18.00.'));
});

test('state: windows, window_closed, too_early and the check-out block', function () {
    $user = F::employee();
    $token = wToken($user);
    jamAbsen($user, ['check_in' => ['from' => '07:00', 'until' => '09:00'], 'check_out' => ['from' => '16:00', 'until' => null]]);

    $this->travelTo(F::at('2026-10-05 06:30'));
    $state = wState($token)['state'];
    expect($state['code'])->toBe('too_early')
        ->and($state['canCheckIn'])->toBeFalse()
        ->and($state['windowOpensAt'])->toBe('2026-10-05T00:00:00Z')
        ->and($state['message'])->toBe('Absen masuk dibuka pukul 07.00 dan ditutup pukul 09.00.')
        ->and($state['windows'])->toBe(['checkIn' => ['from' => '07:00', 'until' => '09:00'], 'checkOut' => ['from' => '16:00', 'until' => null]])
        ->and($state['checkOutBlockedReason'])->toBeNull();

    $this->travelTo(F::at('2026-10-05 09:30'));
    $state = wState($token)['state'];
    expect($state['code'])->toBe('window_closed')
        ->and($state['label'])->toBe('Check-in sudah ditutup')
        ->and($state['canCheckIn'])->toBeFalse()
        ->and($state['message'])->toBe('Absen masuk dibuka pukul 07.00 dan ditutup pukul 09.00.')
        ->and($state['center']['action'])->toBe('workspace');

    $this->travelTo(F::at('2026-10-05 08:00'));
    $this->withToken($token)->post('/api/v1/absensi/check-in', [
        'latitude' => F::OFFICE_LAT + 0.0003, 'longitude' => F::OFFICE_LNG, 'accuracy' => 12, 'selfie' => F::selfie(),
    ], ['Accept' => 'application/json'])->assertCreated();

    $this->travelTo(F::at('2026-10-05 12:00'));
    $state = wState($token)['state'];
    expect($state['code'])->toBe('checked_in')
        ->and($state['canCheckOut'])->toBeFalse()
        ->and($state['checkOutBlockedReason'])->toBe('Absen pulang dibuka pukul 16.00.');

    $this->travelTo(F::at('2026-10-05 16:30'));
    $state = wState($token)['state'];
    expect($state['canCheckOut'])->toBeTrue()->and($state['checkOutBlockedReason'])->toBeNull();
});

test('state without windows keeps the old shape and behaviour', function () {
    $user = F::employee();

    $this->travelTo(F::at('2026-10-05 07:30'));
    $state = wState(wToken($user))['state'];

    expect($state['code'])->toBe('not_checked_in')
        ->and($state['canCheckIn'])->toBeTrue()
        ->and($state['windows'])->toBe(['checkIn' => null, 'checkOut' => null])
        ->and($state['checkOutBlockedReason'])->toBeNull()
        ->and($state['windowOpensAt'])->toBe('2026-10-04T23:00:00Z');
});

// --- Admin: SaveAttendanceWindows ------------------------------------------------

test('HR saves the windows: stored in company settings and audited', function () {
    $this->seed(RoleSeeder::class);
    $hr = User::factory()->withRole(Role::Hr)->create();

    $this->actingAs($hr)->put(route('admin.attendance.windows.update'), [
        'check_in_from' => '06:00',
        'check_in_until' => '12:00',
        'check_out_from' => '15:00',
        'check_out_until' => '',
    ])->assertSessionHasNoErrors()->assertRedirect();

    $company = Company::query()->findOrFail($hr->company_id);

    expect($company->settings[AttendanceWindows::KEY])->toBe([
        'check_in' => ['from' => '06:00', 'until' => '12:00'],
        'check_out' => ['from' => '15:00', 'until' => null],
    ]);

    $audit = AuditLog::query()->where('action', 'attendance.windows_updated')->sole();

    expect($audit->user_id)->toBe($hr->id)
        ->and($audit->old_values)->toBeNull()
        ->and($audit->new_values['check_in'])->toBe(['from' => '06:00', 'until' => '12:00']);

    // The page reads them back.
    $this->actingAs($hr)->get(route('admin.attendance.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('windows.checkIn', ['from' => '06:00', 'until' => '12:00'])
            ->where('windows.checkOut', ['from' => '15:00', 'until' => null]));
});

test('saving empty fields removes the limit and keeps other company settings', function () {
    $this->seed(RoleSeeder::class);
    $hr = User::factory()->withRole(Role::Hr)->create();
    $company = Company::query()->findOrFail($hr->company_id);
    $company->settings = ['selfie_retention_months' => 12, AttendanceWindows::KEY => ['check_in' => ['from' => '06:00', 'until' => '12:00']]];
    $company->saveQuietly();

    $this->actingAs($hr)->put(route('admin.attendance.windows.update'), [])->assertSessionHasNoErrors();

    expect(Company::query()->findOrFail($hr->company_id)->settings)->toBe(['selfie_retention_months' => 12])
        ->and(AuditLog::query()->where('action', 'attendance.windows_updated')->count())->toBe(1);

    // Unchanged save writes no new audit row.
    $this->actingAs($hr)->put(route('admin.attendance.windows.update'), [])->assertSessionHasNoErrors();
    expect(AuditLog::query()->where('action', 'attendance.windows_updated')->count())->toBe(1);
});

test('the windows are validated: 24h format and until after from', function (array $fields, string $key) {
    $this->seed(RoleSeeder::class);
    $hr = User::factory()->withRole(Role::Hr)->create();

    $this->actingAs($hr)->put(route('admin.attendance.windows.update'), $fields)->assertSessionHasErrors($key);

    expect(Company::query()->findOrFail($hr->company_id)->settings)->not->toHaveKey(AttendanceWindows::KEY);
})->with([
    'until equals from' => [['check_in_from' => '08:00', 'check_in_until' => '08:00'], 'check_in_until'],
    'until before from' => [['check_out_from' => '17:00', 'check_out_until' => '16:00'], 'check_out_until'],
    'not a time' => [['check_in_from' => '25:00'], 'check_in_from'],
    'words' => [['check_out_until' => 'sore'], 'check_out_until'],
]);

test('only HR and Super Admin can change the windows', function (Role $role, bool $allowed) {
    $this->seed(RoleSeeder::class);
    $actor = User::factory()->withRole($role)->create();

    $response = $this->actingAs($actor)->put(route('admin.attendance.windows.update'), ['check_in_from' => '06:00', 'check_in_until' => '12:00']);

    $allowed ? $response->assertSessionHasNoErrors() : $response->assertForbidden();
    expect(array_key_exists(AttendanceWindows::KEY, Company::query()->findOrFail($actor->company_id)->settings))->toBe($allowed);
})->with([
    'hr' => [Role::Hr, true],
    'super admin' => [Role::SuperAdmin, true],
    'direksi' => [Role::Direksi, false],
    'kepala divisi' => [Role::KepalaDivisi, false],
    'anggota' => [Role::Anggota, false],
]);

test('the action rewrites only its own key and tolerates a malformed value', function () {
    $this->seed(RoleSeeder::class);
    $hr = User::factory()->withRole(Role::Hr)->create();
    $company = Company::query()->findOrFail($hr->company_id);
    $company->settings = [AttendanceWindows::KEY => 'rusak'];
    $company->saveQuietly();

    expect(AttendanceWindows::forUser($hr)->isEmpty())->toBeTrue();

    app(SaveAttendanceWindows::class)->handle($hr, new AttendanceWindows('07:00', null, null, '18:00'));

    expect(AttendanceWindows::forUser($hr)->toProps())->toBe([
        'checkIn' => ['from' => '07:00', 'until' => null],
        'checkOut' => ['from' => null, 'until' => '18:00'],
    ]);
});
