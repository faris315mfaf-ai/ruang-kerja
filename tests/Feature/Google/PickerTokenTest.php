<?php

use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    Http::preventStrayRequests();
    GoogleTesting::disable();
    GoogleTesting::configureOAuth();
    $this->user = User::factory()->create();
});

it('is only for signed-in users', function () {
    $this->getJson('/google/picker-token')->assertUnauthorized();
});

it('says when the Picker is not configured', function () {
    GoogleTesting::disable();

    $this->actingAs($this->user)->getJson('/google/picker-token')
        ->assertOk()
        ->assertExactJson([
            'status' => 'not_configured',
            'message' => 'Google Picker belum diaktifkan. Hubungi admin RuangKerja.',
        ]);
});

it('asks to connect when there is no account with Drive access', function (bool $withAccount) {
    if ($withAccount) {
        GoogleAccount::factory()->for($this->user)->withoutDriveScope()->create();
    }

    $this->actingAs($this->user)->getJson('/google/picker-token')
        ->assertOk()
        ->assertJson([
            'status' => 'not_connected',
            'message' => 'Hubungkan akun Google Anda dulu untuk memilih file dari Drive.',
            'connect_url' => route('google.connect'),
        ]);
})->with(['no account' => false, 'no drive scope' => true]);

it('returns a short-lived token and the Picker settings without caching', function () {
    GoogleAccount::factory()->for($this->user)->create(['access_token' => 'ya29.fresh', 'expires_at' => now()->addMinutes(30)]);

    $this->actingAs($this->user)->getJson('/google/picker-token')
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJson([
            'status' => 'ready',
            'access_token' => 'ya29.fresh',
            'developer_key' => 'picker-api-key',
            'app_id' => '123456789012',
            'locale' => 'id',
        ]);

    Http::assertNothingSent();
});

it('refreshes an expired token first', function () {
    $this->travelTo(now());
    $account = GoogleAccount::factory()->for($this->user)->expired()->create(['refresh_token' => '1//refresh']);
    Http::fake(['oauth2.googleapis.com/token' => Http::response([
        'access_token' => 'ya29.renewed',
        'expires_in' => 3599,
        'scope' => 'openid '.GoogleAccount::DRIVE_FILE_SCOPE,
    ])]);

    $this->actingAs($this->user)->getJson('/google/picker-token')
        ->assertOk()
        ->assertJson(['status' => 'ready', 'access_token' => 'ya29.renewed']);

    Http::assertSent(fn (Request $request) => $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === '1//refresh'
        && $request['client_id'] === '123456789012-abc123.apps.googleusercontent.com');

    expect($account->fresh()->access_token)->toBe('ya29.renewed')
        ->and($account->fresh()->expires_at?->greaterThan(now()->addMinutes(50)))->toBeTrue()
        ->and($account->fresh()->refresh_token)->toBe('1//refresh');
});

it('asks to reconnect when Google revoked the grant', function () {
    $account = GoogleAccount::factory()->for($this->user)->expired()->create();
    Http::fake(['oauth2.googleapis.com/token' => Http::response(['error' => 'invalid_grant', 'error_description' => 'Token has been expired or revoked.'], 400)]);

    $this->actingAs($this->user)->getJson('/google/picker-token')
        ->assertOk()
        ->assertJson([
            'status' => 'reconnect_required',
            'message' => 'Sambungan Google Anda kedaluwarsa. Hubungkan ulang akun Google Anda.',
        ]);

    expect($account->fresh()->refresh_token)->toBeNull()
        ->and($account->fresh()->needsReconnect())->toBeTrue();

    // Next time it answers without calling Google.
    $this->actingAs($this->user)->getJson('/google/picker-token')->assertJson(['status' => 'reconnect_required']);
    Http::assertSentCount(1);
});

it('reports Google outages without exposing tokens', function () {
    GoogleAccount::factory()->for($this->user)->expired()->create(['refresh_token' => '1//refresh']);
    Http::fake(['oauth2.googleapis.com/token' => Http::response(['error' => 'internal_failure'], 503)]);

    $response = $this->actingAs($this->user)->getJson('/google/picker-token')
        ->assertStatus(502)
        ->assertJson(['status' => 'error']);

    expect($response->getContent())->not->toContain('1//refresh');
});
