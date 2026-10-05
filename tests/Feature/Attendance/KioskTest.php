<?php

use App\Domain\Attendance\Actions\IssueKioskActivation;
use App\Domain\Attendance\Actions\SaveKiosk;
use App\Domain\Attendance\Enums\AttendanceLogType;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Models\OfficeLocation;
use App\Domain\Attendance\Models\QrToken;
use App\Domain\Organization\Enums\Role;
use App\Http\Middleware\RestrictKioskDevice;
use App\Http\Resources\Attendance\KioskScreen;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Auth;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->office = F::office();
    $this->kiosk = Kiosk::factory()->at($this->office)->paired()->create(['name' => 'Lobi', 'code' => 'KP-LOBI']);
    $this->travelTo(F::at('2026-10-05 07:52:10'));
});

/**
 * Signs the test client in as the kiosk device (guard + session marker).
 */
function asKiosk(Kiosk $kiosk): void
{
    // Like actingAs() but without switching the default guard (as in production).
    Auth::guard('kiosk')->setUser($kiosk);
    test()->withSession([RestrictKioskDevice::SESSION_KEY => RestrictKioskDevice::marker($kiosk)]);
}

test('the kiosk page shows a full-screen QR for its location', function () {
    asKiosk($this->kiosk);

    $this->get(route('kiosk.show', $this->office))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('kiosk/show')
            ->where('kiosk.code', 'KP-LOBI')
            ->where('location.name', 'Kantor Pusat')
            ->where('windowSeconds', 30)
            ->where('code.payload', fn (string $payload) => str_starts_with($payload, 'ruangkerja://checkin?l='.$this->office->id))
            ->where('code.svg', fn (string $svg) => str_starts_with($svg, '<svg') && str_contains($svg, 'currentColor'))
            ->where('code.validFrom', '2026-10-05T00:52:00Z')
            ->where('code.validUntil', '2026-10-05T00:52:30Z')
            ->has('recent', 0)
            ->missing('auth.user.id'));

    expect(QrToken::query()->sole()->kiosk_id)->toBe($this->kiosk->id)
        ->and($this->kiosk->fresh()?->last_seen_at)->not->toBeNull();
});

test('the code endpoint returns the next QR and the latest check-ins (first name + initial)', function () {
    $rizky = User::factory()->create(['name' => 'Rizky Aditya Pratama']);
    $day = AttendanceDay::factory()->for($rizky)->create(['work_date' => '2026-10-05']);
    AttendanceLog::factory()->for($rizky)->for($day, 'day')->create([
        'type' => AttendanceLogType::CheckIn,
        'office_location_id' => $this->office->id,
        'occurred_at' => F::at('2026-10-05 07:41'),
    ]);
    asKiosk($this->kiosk);

    $this->travel(30)->seconds();

    $this->getJson(route('kiosk.code', $this->office))
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('code.validFrom', '2026-10-05T00:52:30Z')
        ->assertJsonPath('recent.0.name', 'Rizky P.')
        ->assertJsonPath('recent.0.initials', 'RP')
        ->assertJsonMissingPath('recent.0.email');
});

test('a kiosk cannot open any other page', function (string $uri) {
    asKiosk($this->kiosk);

    $this->get($uri)->assertRedirect(route('kiosk.show', $this->office));
})->with([
    '/dashboard', '/absensi', '/absensi/riwayat', '/absensi/hari-ini', '/absensi/rekap', '/admin/absensi', '/admin/karyawan',
    '/inbox', '/settings/profile', '/login', '/menu',
]);

test('a kiosk gets 403 on JSON endpoints', function () {
    asKiosk($this->kiosk);

    $this->postJson(route('attendance.check-in.qr'), ['payload' => 'x'])->assertForbidden();
    $this->getJson('/broadcasting/auth')->assertForbidden();
});

test('a kiosk cannot open the kiosk page of another location', function () {
    $warehouse = OfficeLocation::factory()->create();
    asKiosk($this->kiosk);

    $this->get(route('kiosk.show', $warehouse))->assertForbidden();
    $this->getJson(route('kiosk.code', $warehouse))->assertForbidden();
});

test('guests and employees cannot open the kiosk page', function () {
    $this->get(route('kiosk.show', $this->office))->assertRedirect(route('kiosk.unpaired'));
    $this->getJson(route('kiosk.code', $this->office))->assertUnauthorized();

    $hr = User::factory()->withRole(Role::Hr)->create();
    $this->actingAs($hr)->get(route('kiosk.show', $this->office))->assertRedirect(route('kiosk.unpaired'));
});

test('the unpaired page sends a paired kiosk to its screen', function () {
    $this->get(route('kiosk.unpaired'))->assertOk()->assertInertia(fn (Assert $page) => $page->component('kiosk/unpaired'));

    asKiosk($this->kiosk);
    $this->get(route('kiosk.unpaired'))->assertRedirect(route('kiosk.show', $this->office));
});

test('a deactivated or deleted kiosk is signed out', function (string $how) {
    asKiosk($this->kiosk);
    $hr = User::factory()->withRole(Role::Hr)->create();

    if ($how === 'deactivated') {
        app(SaveKiosk::class)->handle($hr, ['name' => 'Lobi', 'code' => 'KP-LOBI', 'office_location_id' => $this->office->id, 'is_active' => false], $this->kiosk);
    } else {
        $this->kiosk->delete();
    }

    $this->get(route('kiosk.show', $this->office))->assertRedirect(route('kiosk.unpaired'));
    $this->assertGuest('kiosk');
})->with(['deactivated', 'deleted']);

test('pairing another device signs out the previous one', function () {
    asKiosk($this->kiosk);
    $this->get(route('kiosk.show', $this->office))->assertOk();

    $this->travel(1)->minutes();
    $this->kiosk->forceFill(['activated_at' => now()->startOfSecond()])->saveQuietly();

    $this->get(route('kiosk.show', $this->office))->assertRedirect(route('kiosk.unpaired'));
});

test('HR activates a device with a single-use link', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();

    $url = (string) $this->actingAs($hr)
        ->postJson(route('admin.attendance.kiosks.activation', $this->kiosk))
        ->assertOk()
        ->assertJsonPath('expiresAt', '2026-10-06T00:52:10Z')
        ->json('url');

    expect($url)->toStartWith(route('kiosk.unpaired').'/aktivasi/')
        ->and(AuditLog::query()->where('action', 'kiosk.activation_issued')->count())->toBe(1);

    $token = basename($url);
    expect(Kiosk::query()->whereKey($this->kiosk->id)->value('activation_token_hash'))->toBe(hash('sha256', $token));

    // Opening the link only shows a confirmation.
    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('kiosk/activate')
        ->where('kiosk.code', 'KP-LOBI')
        ->where('kiosk.locationName', 'Kantor Pusat'));
    $this->assertAuthenticatedAs($hr);

    $this->post($url)->assertRedirect(route('kiosk.show', $this->office));
    $this->assertAuthenticatedAs($this->kiosk->fresh() ?? $this->kiosk, 'kiosk');
    $this->assertGuest('web');

    // Used: the same link no longer works.
    expect(Kiosk::query()->whereKey($this->kiosk->id)->value('activation_token_hash'))->toBeNull();
    Auth::guard('kiosk')->logout();
    $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->where('kiosk', null));
    $this->post($url)->assertRedirect(route('kiosk.activate.show', ['token' => $token]));
    $this->assertGuest('kiosk');
});

test('activation links expire', function () {
    $activation = app(IssueKioskActivation::class)->handle($this->kiosk);

    $this->travel(25)->hours();

    $this->post(route('kiosk.activate.store', ['token' => $activation['token']]))->assertRedirect();
    $this->assertGuest('kiosk');
});

test('only HR and Super Admin manage kiosks', function (Role $role, bool $allowed) {
    $actor = User::factory()->withRole($role)->create();
    $payload = ['name' => 'Lobi 2', 'code' => 'kp-lobi2', 'office_location_id' => $this->office->id, 'is_active' => true];

    $response = $this->actingAs($actor)->post(route('admin.attendance.kiosks.store'), $payload);

    if ($allowed) {
        $response->assertRedirect();
        expect(Kiosk::query()->where('code', 'KP-LOBI2')->exists())->toBeTrue();
        $this->actingAs($actor)->postJson(route('admin.attendance.kiosks.activation', $this->kiosk))->assertOk();
    } else {
        $response->assertForbidden();
        $this->actingAs($actor)->postJson(route('admin.attendance.kiosks.activation', $this->kiosk))->assertForbidden();
        $this->actingAs($actor)->delete(route('admin.attendance.kiosks.destroy', $this->kiosk))->assertForbidden();
    }
})->with([
    [Role::SuperAdmin, true],
    [Role::Hr, true],
    [Role::Direksi, false],
    [Role::KepalaDivisi, false],
    [Role::Anggota, false],
]);

test('kiosk codes are unique per company and the location must belong to it', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $foreign = OfficeLocation::factory()->forCompany(Company::factory()->create())->create();

    $this->actingAs($hr)->post(route('admin.attendance.kiosks.store'), ['name' => 'X', 'code' => 'KP-LOBI', 'office_location_id' => $this->office->id, 'is_active' => true])
        ->assertSessionHasErrors(['code' => 'Kode kiosk ini sudah dipakai.']);
    $this->actingAs($hr)->post(route('admin.attendance.kiosks.store'), ['name' => 'X', 'code' => 'BARU', 'office_location_id' => $foreign->id, 'is_active' => true])
        ->assertSessionHasErrors('office_location_id');
});

test('inactive kiosks cannot get an activation link', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    $this->kiosk->update(['is_active' => false]);

    $this->actingAs($hr)->postJson(route('admin.attendance.kiosks.activation', $this->kiosk))->assertForbidden();
});

test('public names show the first name and an initial only', function (string $name, string $public, string $initials) {
    expect(KioskScreen::publicName($name))->toBe($public)->and(KioskScreen::initials($name))->toBe($initials);
})->with([
    ['Sari Wulandari', 'Sari W.', 'SW'],
    ['Rizky', 'Rizky', 'R'],
    ['  dimas  pratama  putra ', 'dimas P.', 'DP'],
]);
