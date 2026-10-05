<?php

use App\Domain\Attendance\Actions\ActivateKiosk;
use App\Domain\Attendance\Actions\IssueKioskActivation;
use App\Domain\Attendance\Models\Kiosk;
use App\Domain\Attendance\Support\KioskActivationCode;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Testing\TestResponse;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->office = F::office();
    $this->kiosk = Kiosk::factory()->at($this->office)->create(['name' => 'Lobi', 'code' => 'KP-LOBI']);
    $this->travelTo(F::at('2026-10-05 07:52:10'));
});

/**
 * Issues a link + code for the test kiosk.
 *
 * @return array{token: string, code: string}
 */
function issueKioskActivation(Kiosk $kiosk): array
{
    $activation = app(IssueKioskActivation::class)->handle($kiosk);

    return ['token' => $activation['token'], 'code' => $activation['code']];
}

function redeemKioskCode(string $code): TestResponse
{
    return test()->from(route('kiosk.unpaired'))->post(route('kiosk.activate.code'), ['code' => $code]);
}

test('HR gets a short pairing code together with the link', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();

    $response = $this->actingAs($hr)
        ->postJson(route('admin.attendance.kiosks.activation', $this->kiosk))
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('expiresAt', '2026-10-06T00:52:10Z')
        ->assertJsonPath('pairUrl', route('kiosk.unpaired'));

    $code = (string) $response->json('code');
    expect($code)->toMatch('/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/')
        ->and(Kiosk::query()->whereKey($this->kiosk->id)->value('activation_code_hash'))
        ->toBe(KioskActivationCode::hash(str_replace('-', '', $code)))
        // Neither the code nor its hash leak into the admin props or audit trail.
        ->and(json_encode(AuditLog::query()->get()->toArray()))->not->toContain(str_replace('-', '', $code));
});

test('a valid code pairs the device and signs out the employee session', function () {
    $hr = User::factory()->withRole(Role::Hr)->create();
    ['code' => $code] = issueKioskActivation($this->kiosk);

    $this->actingAs($hr);
    redeemKioskCode($code)->assertRedirect(route('kiosk.show', $this->office));

    $this->assertAuthenticatedAs($this->kiosk->fresh() ?? $this->kiosk, 'kiosk');
    $this->assertGuest('web');

    $fresh = Kiosk::query()->findOrFail($this->kiosk->id);
    expect($fresh->activation_code_hash)->toBeNull()
        ->and($fresh->activation_token_hash)->toBeNull()
        ->and($fresh->activated_at?->toIso8601ZuluString())->toBe('2026-10-05T00:52:10Z')
        ->and(AuditLog::query()->where('action', 'kiosk.activated')->sole()->new_values)->toBe(['via' => 'code']);

    $this->get(route('kiosk.show', $this->office))->assertOk();
});

test('codes are accepted in lower case, without the dash and with spaces', function (callable $mangle) {
    ['code' => $code] = issueKioskActivation($this->kiosk);

    redeemKioskCode($mangle($code))->assertRedirect(route('kiosk.show', $this->office));
    $this->assertAuthenticatedAs($this->kiosk->fresh() ?? $this->kiosk, 'kiosk');
})->with([
    'lower case' => [fn (string $code): string => strtolower($code)],
    'no dash' => [fn (string $code): string => str_replace('-', '', $code)],
    'spaces' => [fn (string $code): string => ' '.str_replace('-', ' ', $code).' '],
]);

test('a code is single-use', function () {
    ['code' => $code] = issueKioskActivation($this->kiosk);

    redeemKioskCode($code)->assertRedirect(route('kiosk.show', $this->office));
    Auth::guard('kiosk')->logout();

    redeemKioskCode($code)->assertRedirect(route('kiosk.unpaired'))->assertSessionHasErrors('code');
    $this->assertGuest('kiosk');
});

test('codes expire with the link', function () {
    ['code' => $code] = issueKioskActivation($this->kiosk);

    $this->travel(25)->hours();

    redeemKioskCode($code)->assertSessionHasErrors(['code' => 'Kode aktivasi salah, sudah dipakai, atau kedaluwarsa. Minta HR membuat kode baru bila perlu.']);
    $this->assertGuest('kiosk');
});

test('wrong, malformed or empty codes are rejected', function (string $input, string $message) {
    issueKioskActivation($this->kiosk);

    redeemKioskCode($input)->assertSessionHasErrors(['code' => $message]);
    $this->assertGuest('kiosk');
    expect(Kiosk::query()->whereKey($this->kiosk->id)->value('activated_at'))->toBeNull();
})->with([
    'unknown' => ['ABCD-2345', 'Kode aktivasi salah, sudah dipakai, atau kedaluwarsa. Minta HR membuat kode baru bila perlu.'],
    'ambiguous characters' => ['O0I1-L234', 'Kode aktivasi salah, sudah dipakai, atau kedaluwarsa. Minta HR membuat kode baru bila perlu.'],
    'too short' => ['ABC', 'Kode aktivasi salah, sudah dipakai, atau kedaluwarsa. Minta HR membuat kode baru bila perlu.'],
    'too long' => [str_repeat('A', 21), 'Kode aktivasi tidak berlaku.'],
    'empty' => ['', 'Masukkan kode aktivasi.'],
]);

test('a deactivated kiosk cannot be paired with its code', function () {
    ['code' => $code] = issueKioskActivation($this->kiosk);
    $this->kiosk->forceFill(['is_active' => false])->saveQuietly();

    redeemKioskCode($code)->assertSessionHasErrors('code');
    $this->assertGuest('kiosk');
});

test('using the link invalidates the code and vice versa', function () {
    ['token' => $token, 'code' => $code] = issueKioskActivation($this->kiosk);

    expect(app(ActivateKiosk::class)->handle($token))->not->toBeNull();
    redeemKioskCode($code)->assertSessionHasErrors('code');
    $this->assertGuest('kiosk');

    // Fresh model, as the admin endpoint loads it per request.
    ['token' => $token, 'code' => $code] = issueKioskActivation($this->kiosk->refresh());
    redeemKioskCode($code)->assertRedirect(route('kiosk.show', $this->office));
    Auth::guard('kiosk')->logout();

    $this->post(route('kiosk.activate.store', ['token' => $token]))->assertRedirect(route('kiosk.activate.show', ['token' => $token]));
    $this->assertGuest('kiosk');
});

test('issuing a new activation replaces the previous code', function () {
    ['code' => $old] = issueKioskActivation($this->kiosk);
    ['code' => $new] = issueKioskActivation($this->kiosk);

    redeemKioskCode($old)->assertSessionHasErrors('code');
    redeemKioskCode($new)->assertRedirect(route('kiosk.show', $this->office));
});

test('the activation link keeps working on its own', function () {
    ['token' => $token] = issueKioskActivation($this->kiosk);

    $this->post(route('kiosk.activate.store', ['token' => $token]))->assertRedirect(route('kiosk.show', $this->office));
    $this->assertAuthenticatedAs($this->kiosk->fresh() ?? $this->kiosk, 'kiosk');
    expect(AuditLog::query()->where('action', 'kiosk.activated')->sole()->new_values)->toBe(['via' => 'link']);
});

test('code attempts are limited to 5 per minute per IP', function () {
    ['code' => $code] = issueKioskActivation($this->kiosk);

    foreach (range(1, 4) as $attempt) {
        redeemKioskCode('ABCD-2345')->assertSessionHasErrors('code');
    }

    // 5th attempt is still allowed …
    redeemKioskCode('ABCD-2346')->assertSessionHasErrors('code');

    // … the 6th is refused even with the right code.
    redeemKioskCode($code)->assertSessionHasErrors(['code' => 'Terlalu banyak percobaan. Coba lagi dalam 60 detik.']);
    $this->assertGuest('kiosk');

    // Another IP is not affected.
    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.9']);
    redeemKioskCode($code)->assertRedirect(route('kiosk.show', $this->office));
});

test('an IP is locked out after 10 wrong codes', function () {
    ['code' => $code] = issueKioskActivation($this->kiosk);

    foreach (range(1, 10) as $attempt) {
        if ($attempt % 5 === 0) {
            $this->travel(61)->seconds();
        }
        redeemKioskCode('ABCD-2345')->assertSessionHasErrors('code');
    }

    $this->travel(2)->minutes();
    redeemKioskCode($code)->assertSessionHasErrors(['code' => 'Terlalu banyak percobaan. Coba lagi dalam 11 menit.']);
    $this->assertGuest('kiosk');

    $this->travel(15)->minutes();
    redeemKioskCode($code)->assertRedirect(route('kiosk.show', $this->office));
});
