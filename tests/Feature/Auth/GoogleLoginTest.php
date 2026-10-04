<?php

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Enums\Role;
use App\Http\Controllers\Auth\GoogleLoginController;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'services.google.client_id' => 'test-client-id',
        'services.google.client_secret' => 'test-client-secret',
        'services.google.redirect' => '/auth/google/callback',
    ]);

    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
});

/**
 * @param  array<string, mixed>  $overrides  raw OpenID userinfo claims
 */
function fakeGoogleUser(array $overrides = []): SocialiteUser
{
    $raw = array_merge([
        'sub' => 'google-sub-123',
        'email' => 'budi@kantor.test',
        'email_verified' => true,
        'hd' => 'kantor.test',
        'name' => 'Budi Santoso',
        'picture' => 'https://lh3.googleusercontent.com/a/budi',
    ], $overrides);

    $user = (new SocialiteUser)->setRaw(array_filter($raw, fn ($value) => $value !== null))->map([
        'id' => $raw['sub'],
        'name' => $raw['name'],
        'email' => $raw['email'],
        'avatar' => $raw['picture'],
    ]);

    Socialite::fake('google', $user);

    return $user;
}

function googleCallback(): TestResponse
{
    return test()->get(route('auth.google.callback', ['state' => 'x', 'code' => 'y']));
}

it('redirects to Google with the workspace domain hint', function () {
    $location = $this->get(route('auth.google.redirect'))->assertRedirect()->headers->get('Location');

    expect($location)->toStartWith('https://accounts.google.com/o/oauth2/auth')
        ->toContain('hd=kantor.test')
        ->toContain('prompt=select_account')
        ->toContain('client_id=test-client-id')
        ->toContain(urlencode(url('/auth/google/callback')));
});

it('shows a friendly error when Google login is not configured', function () {
    config(['services.google.client_id' => null]);

    $this->get(route('auth.google.redirect'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['google' => GoogleLoginController::NOT_CONFIGURED]);

    googleCallback()->assertSessionHasErrors(['google' => GoogleLoginController::NOT_CONFIGURED]);

    $this->assertGuest();
});

it('tells the login page whether Google is configured', function (bool $configured) {
    if (! $configured) {
        config(['services.google.client_secret' => '']);
    }

    $this->get(route('login'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/login')
            ->where('google.enabled', $configured)
            ->where('google.domain', 'kantor.test')
            ->where('companyName', $this->company->name),
        );
})->with([true, false]);

it('logs in an active registered employee and links the Google identity', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 5, 1, 30));

    $user = User::factory()->forCompany($this->company)->unverified()->create([
        'email' => 'budi@kantor.test',
        'password' => null,
    ]);
    fakeGoogleUser();

    googleCallback()->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($user);
    $user->refresh();
    expect($user->google_id)->toBe('google-sub-123')
        ->and($user->avatar_url)->toBe('https://lh3.googleusercontent.com/a/budi')
        ->and($user->last_login_at?->toIso8601String())->toBe(now()->toIso8601String())
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(session(LoginMethod::SESSION_KEY))->toBe('google');
});

it('matches the email case-insensitively', function () {
    $user = User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser(['email' => 'Budi@Kantor.TEST', 'hd' => 'KANTOR.test']);

    googleCallback()->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($user);
});

it('matches by google_id first, even when the Google email changed', function () {
    $linked = User::factory()->forCompany($this->company)->create([
        'email' => 'budi.lama@kantor.test',
        'google_id' => 'google-sub-123',
    ]);
    $sameEmail = User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser();

    googleCallback()->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($linked);
    expect($sameEmail->refresh()->google_id)->toBeNull()
        ->and($linked->refresh()->email)->toBe('budi.lama@kantor.test');
});

it('relinks a re-created Workspace account with the same address', function () {
    $user = User::factory()->forCompany($this->company)->create([
        'email' => 'budi@kantor.test',
        'google_id' => 'old-sub',
    ]);
    fakeGoogleUser(['sub' => 'new-sub']);

    googleCallback()->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($user);
    expect($user->refresh()->google_id)->toBe('new-sub');
});

it('rejects an email outside the company domain', function () {
    User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser(['email' => 'budi@gmail.com', 'hd' => 'kantor.test']);

    googleCallback()
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('google')
        ->assertSessionHas('google_email', 'budi@gmail.com');

    $this->assertGuest();
});

it('rejects a hosted domain that is not the company domain', function () {
    User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser(['hd' => 'lain.test']);

    googleCallback()->assertSessionHasErrors('google');

    $this->assertGuest();
});

it('rejects a personal Google account without the hd claim', function () {
    User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser(['hd' => null]);

    googleCallback()
        ->assertSessionHasErrors(['google' => 'Akun ini bukan akun Google Workspace perusahaan. Gunakan email kantor Anda.']);

    $this->assertGuest();
});

it('rejects an email that Google has not verified', function () {
    User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser(['email_verified' => false]);

    googleCallback()->assertSessionHasErrors('google');

    $this->assertGuest();
});

it('rejects an email not registered by HR', function () {
    fakeGoogleUser(['email' => 'baru@kantor.test']);

    googleCallback()
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['google' => 'Akun Anda belum didaftarkan HR. Hubungi HR untuk mengaktifkan akses.'])
        ->assertSessionHas('google_email', 'baru@kantor.test');

    $this->assertGuest();
});

it('rejects an employee registered in another company', function () {
    $other = Company::factory()->create(['google_domain' => 'lain.test']);
    User::factory()->forCompany($other)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser();

    googleCallback()->assertSessionHasErrors('google');

    $this->assertGuest();
});

it('rejects inactive and resigned employees before logging in', function (string $state) {
    $user = User::factory()->forCompany($this->company)->{$state}()->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser();

    googleCallback()
        ->assertSessionHasErrors(['google' => 'Akun Anda tidak aktif. Hubungi HR bila ini keliru.']);

    $this->assertGuest();
    expect($user->refresh()->google_id)->toBeNull()
        ->and($user->last_login_at)->toBeNull();
})->with(['inactive', 'resigned']);

it('handles a cancelled consent screen', function () {
    fakeGoogleUser();

    $this->get(route('auth.google.callback', ['error' => 'access_denied']))
        ->assertSessionHasErrors(['google' => GoogleLoginController::FAILED]);

    $this->assertGuest();
});

it('handles an invalid OAuth state', function () {
    Socialite::fake('google', fn () => throw new InvalidStateException);

    googleCallback()->assertSessionHasErrors(['google' => GoogleLoginController::FAILED]);

    $this->assertGuest();
});

it('regenerates the session on login', function () {
    User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser();

    $this->startSession();
    $before = session()->getId();

    googleCallback()->assertRedirect('/dashboard');

    expect(session()->getId())->not->toBe($before);
});

it('audits a Super Admin Google sign-in', function () {
    $this->seed(RoleSeeder::class);
    $admin = User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser();

    googleCallback()->assertRedirect('/dashboard');

    $log = AuditLog::query()->where('action', 'user.logged_in')->sole();
    expect($log->user_id)->toBe($admin->id)
        ->and($log->new_values)->toBe(['method' => 'google']);
});

it('does not force TOTP setup on a Super Admin who signed in with Google', function () {
    $this->seed(RoleSeeder::class);
    User::factory()->forCompany($this->company)->withRole(Role::SuperAdmin)->create(['email' => 'budi@kantor.test']);
    fakeGoogleUser();

    googleCallback();

    $this->get('/dashboard')->assertOk();
});

it('is only available to guests', function () {
    $user = User::factory()->forCompany($this->company)->create();
    fakeGoogleUser();

    $this->actingAs($user)->get(route('auth.google.redirect'))->assertRedirect();

    $this->assertAuthenticatedAs($user);
});

it('is rate limited to 10 requests per minute per IP', function () {
    Socialite::fake('google');

    foreach (range(1, 10) as $attempt) {
        $this->get(route('auth.google.redirect'))->assertRedirect();
    }

    $this->get(route('auth.google.redirect'))->assertTooManyRequests();
});
