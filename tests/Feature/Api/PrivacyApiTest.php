<?php

use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Attendance\Actions\GiveAttendanceConsent;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Notifications\ConsentRevokedNotification;
use App\Domain\Devices\Models\Device;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Mail\DesktopLinkMail;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\EmployeeProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Maatwebsite\Excel\Facades\Excel;

/*
| API v1 — Bagian 1 / B2: Privasi & perangkat (Data Saya, ekspor, persetujuan
| lokasi+selfie, kebijakan privasi JSON, sakelar biometrik, tautan desktop).
| Semua hanya menyentuh data pemilik token.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));

    $company = Company::factory()->create(['google_domain' => 'kantor.test']);
    $this->rizky = User::factory()->forCompany($company)->withRole(Role::Anggota)->create(['email' => 'rizky@kantor.test']);
    $this->maya = User::factory()->forCompany($company)->withRole(Role::Anggota)->create(['email' => 'maya@kantor.test']);
    $this->hr = User::factory()->forCompany($company)->withRole(Role::Hr)->create(['email' => 'hr@kantor.test']);

    EmployeeProfile::factory()->for($this->rizky)->create(['nik' => '3201234567890123', 'employee_number' => 'EMP-00042']);
    EmployeeProfile::factory()->for($this->maya)->create(['nik' => '3209999999990999']);

    AttendanceDay::factory()->for($this->rizky)->on('2026-10-01')->status(AttendanceStatus::Present)->create();
    AttendanceDay::factory()->for($this->maya)->on('2026-10-01')->status(AttendanceStatus::Wfh)->create();
    AttendanceDay::factory()->for($this->maya)->on('2026-10-02')->status(AttendanceStatus::Wfh)->create();
});

// ---------------------------------------------------------------- Data Saya

test('data saya returns only the callers own data with the NIK masked', function () {
    Sanctum::actingAs($this->rizky);

    $response = $this->getJson('/api/v1/privasi/data-saya')->assertOk()
        ->assertJsonPath('policy.version', '1.0')
        ->assertJsonPath('profile.name', $this->rizky->name)
        ->assertJsonPath('profile.employee_number', 'EMP-00042')
        ->assertJsonPath('profile.nik_masked', '••••••••••••0123')
        ->assertJsonPath('consent.granted', false)
        ->assertJsonPath('attendance.total_days', 1)
        ->assertJsonPath('attendance.counts.present', 1)
        ->assertJsonPath('requests.count', 0)
        ->assertJsonPath('decisions.count', 0)
        ->assertJsonStructure(['status_labels', 'attendance' => ['days', 'logs', 'selfies', 'first_date'], 'consent' => ['types', 'history']]);

    // Neither the raw NIK nor Mayas rows leak.
    expect($response->getContent())->not->toContain('3201234567890123')
        ->not->toContain('3209999999990999')
        ->not->toContain($this->maya->email);
});

test('data saya needs a signed-in active employee', function () {
    $this->getJson('/api/v1/privasi/data-saya')->assertUnauthorized();
    $this->getJson('/api/v1/privasi/ekspor?format=pdf')->assertUnauthorized();
});

test('export streams an audited workbook or PDF over bearer auth', function () {
    Excel::fake();
    Sanctum::actingAs($this->rizky);

    $this->get('/api/v1/privasi/ekspor?format=xlsx')->assertOk();
    Excel::assertDownloaded('data-saya-'.str($this->rizky->name)->slug().'-20261005.xlsx', fn (DashboardExport $export): bool => true);

    $audit = AuditLog::query()->where('action', 'privacy.data_exported')->sole();
    expect($audit->user_id)->toBe($this->rizky->id)
        ->and($audit->new_values)->toMatchArray(['format' => 'xlsx']);
});

test('export as PDF returns a PDF file', function () {
    Sanctum::actingAs($this->rizky);

    $response = $this->get('/api/v1/privasi/ekspor?format=pdf')->assertOk();

    expect($response->headers->get('content-type'))->toBe('application/pdf')
        ->and($response->headers->get('content-disposition'))->toContain('data-saya-');
});

test('export validates the format in Indonesian', function () {
    Sanctum::actingAs($this->rizky);

    $this->getJson('/api/v1/privasi/ekspor')->assertUnprocessable()
        ->assertJsonPath('errors.format.0', 'Format unduhan wajib dipilih (xlsx atau pdf).');
    $this->getJson('/api/v1/privasi/ekspor?format=csv')->assertUnprocessable()
        ->assertJsonPath('errors.format.0', 'Format unduhan harus xlsx atau pdf.');
});

test('export is rate limited to 10 per minute', function () {
    Excel::fake();
    Sanctum::actingAs($this->rizky);

    foreach (range(1, 10) as $i) {
        $this->get('/api/v1/privasi/ekspor?format=xlsx')->assertOk();
    }

    $this->getJson('/api/v1/privasi/ekspor?format=xlsx')->assertStatus(429);
});

// ------------------------------------------------------------- Persetujuan

test('consent status, grant and revoke follow the web actions', function () {
    Notification::fake();
    Sanctum::actingAs($this->rizky);

    $this->getJson('/api/v1/persetujuan')->assertOk()
        ->assertJsonPath('consent.granted', false)
        ->assertJsonPath('consent.version', '1.0')
        ->assertJsonPath('consent.needs_renewal', false)
        ->assertJsonPath('consent.types.location.granted', false)
        ->assertJsonPath('consent.types.selfie.granted', false);

    $this->postJson('/api/v1/persetujuan', ['types' => ['location', 'selfie']])->assertOk()
        ->assertJsonPath('message', 'Persetujuan data lokasi & selfie disimpan.')
        ->assertJsonPath('consent.granted', true)
        ->assertJsonPath('consent.granted_version', '1.0')
        ->assertJsonPath('consent.types.location.granted', true)
        ->assertJsonPath('consent.types.selfie.granted', true)
        ->assertJsonCount(2, 'consent.history');

    expect(AttendanceConsent::hasCurrentConsent($this->rizky))->toBeTrue();

    // Idempotent.
    $this->postJson('/api/v1/persetujuan', ['types' => ['selfie', 'location']])->assertOk();
    expect(AttendanceConsent::query()->where('user_id', $this->rizky->id)->count())->toBe(2);

    $this->deleteJson('/api/v1/persetujuan')->assertOk()
        ->assertJsonPath('message', 'Persetujuan data lokasi & selfie dicabut.')
        ->assertJsonPath('revoked', 2)
        ->assertJsonPath('consent.granted', false);

    expect(AttendanceConsent::hasCurrentConsent($this->rizky))->toBeFalse();
    Notification::assertSentTo($this->hr, ConsentRevokedNotification::class);
    expect(AuditLog::query()->where('action', 'attendance.consent_revoked')->count())->toBe(1);

    // Nothing left to revoke: no second HR notification.
    $this->deleteJson('/api/v1/persetujuan')->assertOk()->assertJsonPath('revoked', 0);
    Notification::assertSentToTimes($this->hr, ConsentRevokedNotification::class, 1);
});

test('consent asks for renewal after the policy version changes', function () {
    app(GiveAttendanceConsent::class)->handle($this->rizky);
    config(['attendance.consent.version' => '2.0', 'privacy.policy.version' => '2.0']);
    Sanctum::actingAs($this->rizky);

    $this->getJson('/api/v1/persetujuan')->assertOk()
        ->assertJsonPath('consent.granted', false)
        ->assertJsonPath('consent.needs_renewal', true)
        ->assertJsonPath('consent.granted_version', '1.0')
        ->assertJsonPath('consent.version', '2.0')
        ->assertJsonPath('consent.types.location.granted', false);
});

test('granting consent validates the types', function () {
    Sanctum::actingAs($this->rizky);

    $this->postJson('/api/v1/persetujuan', [])->assertUnprocessable()->assertJsonValidationErrors('types');
    $this->postJson('/api/v1/persetujuan', ['types' => ['location']])->assertUnprocessable()
        ->assertJsonPath('errors.types.0', 'Persetujuan lokasi dan selfie harus diberikan bersama untuk check-in GPS + selfie.');
    $this->postJson('/api/v1/persetujuan', ['types' => ['location', 'face']])->assertUnprocessable()
        ->assertJsonValidationErrors('types.1');

    expect(AttendanceConsent::query()->count())->toBe(0);
});

test('consent never touches another employee', function () {
    app(GiveAttendanceConsent::class)->handle($this->maya);
    Notification::fake();
    Sanctum::actingAs($this->rizky);

    $this->deleteJson('/api/v1/persetujuan')->assertOk()->assertJsonPath('revoked', 0);

    expect(AttendanceConsent::hasCurrentConsent($this->maya))->toBeTrue();
    $this->getJson('/api/v1/persetujuan')->assertJsonPath('consent.granted', false);
});

// ------------------------------------------------------- Kebijakan privasi

test('the privacy policy is public JSON split into markdown sections', function () {
    $response = $this->getJson('/api/v1/kebijakan-privasi')->assertOk()
        ->assertJsonPath('title', 'Kebijakan Privasi')
        ->assertJsonPath('version', '1.0')
        ->assertJsonPath('effective_date', '2026-10-05')
        ->assertJsonStructure(['sections' => [['title', 'body_markdown']]]);

    $sections = $response->json('sections');
    expect(count($sections))->toBe(9)
        ->and($sections[0]['title'])->toBe('1. Ringkasan')
        ->and($sections[7]['title'])->toBe('8. Hak Anda')
        ->and($response->getContent())->not->toContain('{{')
        ->not->toContain('<!--')
        ->and($sections[0]['body_markdown'])->toContain('UU PDP');
});

test('the policy JSON carries no raw HTML tags', function () {
    $path = tempnam(sys_get_temp_dir(), 'policy');
    file_put_contents($path, "## Satu\n\nTeks <script>alert(1)</script> aman <b>tebal</b>.\n");
    config(['privacy.policy.path' => $path]);

    $body = $this->getJson('/api/v1/kebijakan-privasi')->assertOk()->json('sections.0.body_markdown');
    unlink($path);

    expect($body)->toBe('Teks alert(1) aman tebal.');
});

// --------------------------------------------------------------- Biometrik

test('biometric switch changes only my own device and is audited', function () {
    $mine = Device::factory()->for($this->rizky)->create(['company_id' => $this->rizky->company_id]);
    $other = Device::factory()->for($this->maya)->create(['company_id' => $this->maya->company_id]);
    Sanctum::actingAs($this->rizky);

    expect($mine->biometric_login)->toBeFalse();

    $this->patchJson("/api/v1/perangkat/{$mine->id}/biometrik", ['enabled' => true])->assertOk()
        ->assertJsonPath('biometric_login', true)
        ->assertJsonPath('device_id', $mine->id)
        ->assertJsonPath('message', 'Buka dengan sidik jari diaktifkan.');

    expect($mine->fresh()->biometric_login)->toBeTrue();
    $audit = AuditLog::query()->where('action', 'device.biometric_changed')->sole();
    expect($audit->user_id)->toBe($this->rizky->id);

    // Same value again: no new audit row.
    $this->patchJson("/api/v1/perangkat/{$mine->id}/biometrik", ['enabled' => true])->assertOk();
    expect(AuditLog::query()->where('action', 'device.biometric_changed')->count())->toBe(1);

    $this->patchJson("/api/v1/perangkat/{$mine->id}/biometrik", ['enabled' => false])->assertOk()
        ->assertJsonPath('message', 'Buka dengan sidik jari dimatikan.');

    // Someone elses device, and a missing flag.
    $this->patchJson("/api/v1/perangkat/{$other->id}/biometrik", ['enabled' => true])->assertForbidden();
    expect($other->fresh()->biometric_login)->toBeFalse();
    $this->patchJson("/api/v1/perangkat/{$mine->id}/biometrik", [])->assertUnprocessable()
        ->assertJsonPath('errors.enabled.0', 'Pilihan aktif atau nonaktif wajib dikirim.');
});

test('HR cannot toggle biometrics of an employees device', function () {
    $device = Device::factory()->for($this->rizky)->create(['company_id' => $this->rizky->company_id]);
    Sanctum::actingAs($this->hr);

    $this->patchJson("/api/v1/perangkat/{$device->id}/biometrik", ['enabled' => true])->assertForbidden();
});

test('the device list carries the biometric flag', function () {
    $hash = str_repeat('ab', 32);
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => 'rizky@kantor.test',
        'password' => 'password',
        'device' => ['platform' => 'android', 'device_id_hash' => $hash, 'name' => 'Pixel 8'],
    ])->json('token');

    $device = Device::query()->where('device_id_hash', $hash)->firstOrFail();
    $this->withToken($token)->patchJson("/api/v1/perangkat/{$device->id}/biometrik", ['enabled' => true])->assertOk();

    $this->withToken($token)->getJson('/api/v1/perangkat')->assertOk()
        ->assertJsonPath('devices.0.biometric_login', true);
});

// ---------------------------------------------------------- Tautan desktop

test('a desktop link is queued to the callers own email only', function () {
    Mail::fake();
    Sanctum::actingAs($this->rizky);

    $this->postJson('/api/v1/tautan-desktop', ['path' => '/pengaturan/keamanan', 'email' => 'attacker@evil.test', 'to' => 'x@evil.test'])
        ->assertOk()
        ->assertJsonPath('email', 'rizky@kantor.test')
        ->assertJsonPath('message', 'Tautan dikirim ke rizky@kantor.test.');

    Mail::assertQueued(DesktopLinkMail::class, function (DesktopLinkMail $mail): bool {
        return $mail->hasTo('rizky@kantor.test')
            && ! $mail->hasTo('attacker@evil.test')
            && $mail->url === rtrim(config('app.url'), '/').'/pengaturan/keamanan';
    });
    Mail::assertQueuedCount(1);
    expect(AuditLog::query()->where('action', 'account.desktop_link_sent')->count())->toBe(1);
});

test('the desktop link mail renders with the absolute https url', function () {
    $mail = new DesktopLinkMail('Rizky Pratama', 'https://app.kantor.test/admin/karyawan');

    $mail->assertSeeInHtml('https://app.kantor.test/admin/karyawan')
        ->assertSeeInText('https://app.kantor.test/admin/karyawan')
        ->assertSeeInHtml('Halo, Rizky.');
});

test('desktop link paths outside the allowlist are rejected', function (string $path) {
    Mail::fake();
    Sanctum::actingAs($this->rizky);

    $this->postJson('/api/v1/tautan-desktop', ['path' => $path])->assertUnprocessable()
        ->assertJsonValidationErrors('path');

    Mail::assertNothingQueued();
})->with([
    'unlisted page' => '/tugas/saya',
    'other host' => 'https://evil.test/admin/karyawan',
    'protocol relative' => '//evil.test/admin/karyawan',
    'traversal' => '/admin/../tugas',
    'query string' => '/admin/karyawan?x=1',
    'fragment' => '/admin/karyawan#a',
    'backslash' => '/admin\\karyawan',
    'no leading slash' => 'admin/karyawan',
    'empty' => '',
]);

test('listed desktop paths are accepted', function (string $path) {
    Mail::fake();
    Sanctum::actingAs($this->rizky);

    $this->postJson('/api/v1/tautan-desktop', ['path' => $path])->assertOk();
    Mail::assertQueuedCount(1);
})->with(['/pengaturan/keamanan', '/admin/karyawan', '/admin/pengajuan', '/manajemen/jadwal', '/organisasi/struktur', '/hiring/lowongan']);

test('desktop link is limited to 3 per minute and needs auth', function () {
    $this->postJson('/api/v1/tautan-desktop', ['path' => '/admin/karyawan'])->assertUnauthorized();

    Mail::fake();
    Sanctum::actingAs($this->rizky);

    foreach (range(1, 3) as $i) {
        $this->postJson('/api/v1/tautan-desktop', ['path' => '/admin/karyawan'])->assertOk();
    }

    $this->postJson('/api/v1/tautan-desktop', ['path' => '/admin/karyawan'])->assertStatus(429);
});
