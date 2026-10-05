<?php

use App\Domain\Google\Actions\StoreGoogleAccount;
use App\Domain\Google\Jobs\RevokeGoogleToken;
use App\Models\Company;
use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Tests\Fixtures\Google\GoogleTesting;

beforeEach(function () {
    GoogleTesting::disable();
    GoogleTesting::configureOAuth();
    $company = Company::factory()->create();
    $this->domain = $company->google_domain;
    // The Drive account must belong to the employee's own Workspace identity.
    $this->user = User::factory()->forCompany($company)->create(['email' => 'dimas@'.$this->domain]);
});

function googleUser(string $email, string $hd, array $scopes = ['openid', 'email', GoogleAccount::DRIVE_FILE_SCOPE], ?string $refresh = '1//refresh-token'): SocialiteUser
{
    return SocialiteUser::fake([
        'id' => '1098765',
        'email' => $email,
        'hd' => $hd,
        'token' => 'ya29.user-access',
        'refreshToken' => $refresh,
        'expiresIn' => 3599,
        'approvedScopes' => $scopes,
    ]);
}

it('requires a signed-in user', function (string $method, string $uri) {
    $this->call($method, $uri)->assertRedirect(route('login'));
})->with([
    ['GET', '/google/connect'],
    ['GET', '/google/connect/callback'],
    ['DELETE', '/google/connect'],
    ['GET', '/settings/google'],
]);

it('sends the user to Google asking for drive.file with offline, incremental consent', function () {
    $response = $this->actingAs($this->user)->get('/google/connect?return=/workspace/plq');

    $response->assertRedirect();
    $location = $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

    expect($location)->toStartWith('https://accounts.google.com/o/oauth2/auth')
        ->and($query['client_id'])->toBe('123456789012-abc123.apps.googleusercontent.com')
        ->and($query['redirect_uri'])->toBe('http://localhost/google/connect/callback')
        ->and(explode(' ', $query['scope']))->toContain(GoogleAccount::DRIVE_FILE_SCOPE)
        ->and($query['access_type'])->toBe('offline')
        ->and($query['include_granted_scopes'])->toBe('true')
        ->and($query['prompt'])->toBe('consent')
        ->and($query['login_hint'])->toBe($this->user->email)
        ->and(session('google.connect.return'))->toBe('/workspace/plq');
});

it('answers Inertia visits with a full-page location', function () {
    $this->actingAs($this->user)
        ->get('/google/connect', ['X-Inertia' => 'true'])
        ->assertStatus(409)
        ->assertHeader('X-Inertia-Location');
});

it('ignores unsafe return targets', function (string $target) {
    $this->actingAs($this->user)->get('/google/connect?return='.urlencode($target));

    expect(session('google.connect.return'))->toBe('/settings/google');
})->with(['//evil.test/x', 'https://evil.test', '/\\evil.test', 'javascript:alert(1)']);

it('explains that connecting is unavailable when OAuth is not configured', function () {
    GoogleTesting::disable();

    $this->actingAs($this->user)
        ->get('/google/connect')
        ->assertRedirect('/settings/google')
        ->assertInertiaFlash('toast.type', 'error');
});

it('stores the connected account with encrypted tokens', function () {
    Socialite::fake('google-drive', googleUser('dimas@'.$this->domain, $this->domain));

    $this->actingAs($this->user)
        ->withSession(['google.connect.return' => '/workspace/plq'])
        ->get('/google/connect/callback?code=abc&state=xyz')
        ->assertRedirect('/workspace/plq')
        ->assertInertiaFlash('toast.type', 'success');

    $account = GoogleAccount::query()->sole();
    $raw = DB::table('google_accounts')->first();

    expect($account->user_id)->toBe($this->user->id)
        ->and($account->google_id)->toBe('1098765')
        ->and($account->access_token)->toBe('ya29.user-access')
        ->and($account->refresh_token)->toBe('1//refresh-token')
        ->and($account->hasDriveAccess())->toBeTrue()
        ->and($account->expires_at?->isFuture())->toBeTrue()
        ->and($raw->access_token)->not->toContain('ya29');
});

it('keeps the previous refresh token when Google does not send a new one', function () {
    GoogleAccount::factory()->for($this->user)->create(['google_id' => '1098765', 'refresh_token' => '1//old-refresh']);
    Socialite::fake('google-drive', googleUser('dimas@'.$this->domain, $this->domain, refresh: null));

    $this->actingAs($this->user)->get('/google/connect/callback?code=abc');

    expect(GoogleAccount::query()->sole()->refresh_token)->toBe('1//old-refresh');
});

it('rejects Google accounts outside the company domain', function (string $email, ?string $hd) {
    Socialite::fake('google-drive', googleUser($email, (string) $hd));

    $this->actingAs($this->user)
        ->get('/google/connect/callback?code=abc')
        ->assertRedirect('/settings/google')
        ->assertInertiaFlash('toast.message', "Gunakan akun Google kantor (@{$this->domain}).");

    expect(GoogleAccount::query()->count())->toBe(0);
})->with([
    'personal gmail' => ['someone@gmail.com', ''],
    'domain mismatch on hd' => fn () => ['dimas@'.test()->domain, 'other.test'],
]);

it('honours GOOGLE_ALLOWED_DOMAIN over the company domain', function () {
    config(['google.oauth.allowed_domain' => 'kantor.co.id']);
    $this->user->forceFill(['email' => 'dimas@kantor.co.id'])->save();
    Socialite::fake('google-drive', googleUser('dimas@kantor.co.id', 'kantor.co.id'));

    $this->actingAs($this->user)->get('/google/connect/callback?code=abc');

    expect(GoogleAccount::query()->sole()->email)->toBe('dimas@kantor.co.id');
});

it('warns when the user did not grant Drive access', function () {
    Socialite::fake('google-drive', googleUser('dimas@'.$this->domain, $this->domain, scopes: ['openid', 'email']));

    $this->actingAs($this->user)
        ->get('/google/connect/callback?code=abc')
        ->assertInertiaFlash('toast.type', 'warning');
});

it('handles a cancelled consent screen', function () {
    $this->actingAs($this->user)
        ->get('/google/connect/callback?error=access_denied')
        ->assertRedirect('/settings/google')
        ->assertInertiaFlash('toast.message', 'Sambungan akun Google dibatalkan.');
});

it('handles an expired OAuth state', function () {
    $this->actingAs($this->user)
        ->get('/google/connect/callback?code=abc&state=wrong')
        ->assertRedirect('/settings/google')
        ->assertInertiaFlash('toast.message', 'Sesi sambungan Google kedaluwarsa. Silakan coba lagi.');
});

it('disconnects and revokes the grant through an encrypted job', function () {
    Queue::fake();
    GoogleAccount::factory()->for($this->user)->create(['refresh_token' => '1//to-revoke']);

    $this->actingAs($this->user)
        ->from('/settings/google')
        ->delete('/google/connect')
        ->assertRedirect('/settings/google')
        ->assertInertiaFlash('toast.message', 'Akun Google diputuskan.');

    expect(GoogleAccount::query()->count())->toBe(0);
    Queue::assertPushed(RevokeGoogleToken::class, fn (RevokeGoogleToken $job) => $job->token === '1//to-revoke'
        && $job instanceof ShouldBeEncrypted);
});

it('only disconnects the signed-in user', function () {
    Queue::fake();
    $other = GoogleAccount::factory()->create();

    $this->actingAs($this->user)->delete('/google/connect')->assertInertiaFlash('toast.type', 'info');

    expect($other->fresh())->not->toBeNull();
});

it('revokes tokens in the request body, never in the URL', function () {
    Http::preventStrayRequests();
    Http::fake(['oauth2.googleapis.com/revoke' => Http::response(null, 200)]);

    (new RevokeGoogleToken('1//secret'))->handle();

    Http::assertSent(fn (Request $request) => $request->url() === 'https://oauth2.googleapis.com/revoke'
        && $request['token'] === '1//secret');
});

it('treats an already revoked token as done but retries server errors', function () {
    Http::fake(['oauth2.googleapis.com/revoke' => Http::sequence()->push(['error' => 'invalid_token'], 400)->push(null, 503)]);

    (new RevokeGoogleToken('1//secret'))->handle();

    expect(fn () => (new RevokeGoogleToken('1//secret'))->handle())->toThrow(RuntimeException::class);
});

it('connects with the company domain when GOOGLE_ALLOWED_DOMAIN is empty and the shell preloaded a partial company', function () {
    config(['google.oauth.allowed_domain' => '']);
    // A fresh instance: nothing loaded the full company before HandleInertiaRequests runs.
    $user = User::query()->findOrFail($this->user->id);
    Socialite::fake('google-drive', googleUser($user->email, $this->domain));

    $this->actingAs($user)
        ->get('/google/connect/callback?code=abc')
        ->assertRedirect('/settings/google')
        ->assertInertiaFlash('toast.type', 'success');

    expect(GoogleAccount::query()->sole()->user_id)->toBe($user->id);
});

it('does not overwrite the signed-in user relations with partial shell data', function () {
    $user = User::query()->findOrFail($this->user->id);

    $this->actingAs($user)->get('/settings/google')->assertOk();

    expect($user->relationLoaded('company'))->toBeFalse()
        ->and($user->relationLoaded('division'))->toBeFalse()
        ->and($user->relationLoaded('position'))->toBeFalse();
});

it('reads the company domain fresh even when the user holds a partial company relation', function () {
    config(['google.oauth.allowed_domain' => '']);
    $user = User::query()->findOrFail($this->user->id);
    $user->load('company:id,name');

    $account = app(StoreGoogleAccount::class)->handle($user, googleUser($user->email, $this->domain));

    expect($account->email)->toBe(strtolower($user->email));
});

it('refuses a colleague\'s Workspace account', function () {
    Socialite::fake('google-drive', googleUser('budi@'.$this->domain, $this->domain));

    $this->actingAs($this->user)
        ->get('/google/connect/callback?code=abc')
        ->assertRedirect('/settings/google')
        ->assertInertiaFlash('toast.message', "Gunakan akun Google Anda sendiri ({$this->user->email}).");

    expect(GoogleAccount::query()->count())->toBe(0);
});

it('accepts the own account case-insensitively or by the linked Google id', function () {
    Socialite::fake('google-drive', googleUser(strtoupper('dimas@'.$this->domain), $this->domain));
    $this->actingAs($this->user)->get('/google/connect/callback?code=abc')->assertInertiaFlash('toast.type', 'success');

    // Address renamed at Google, same Google identity as the sign-in.
    $this->user->forceFill(['google_id' => '1098765'])->save();
    Socialite::fake('google-drive', googleUser('dimas.baru@'.$this->domain, $this->domain));
    $this->actingAs($this->user)->get('/google/connect/callback?code=abc')->assertInertiaFlash('toast.type', 'success');

    expect(GoogleAccount::query()->sole()->email)->toBe('dimas.baru@'.$this->domain);
});
