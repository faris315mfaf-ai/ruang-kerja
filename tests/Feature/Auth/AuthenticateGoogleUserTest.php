<?php

use App\Domain\Auth\Actions\AuthenticateGoogleUser;
use App\Domain\Auth\Data\GoogleProfile;
use App\Domain\Auth\Exceptions\LoginRejected;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\User;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    $this->company = Company::factory()->create(['google_domain' => 'kantor.test']);
});

function googleProfile(array $overrides = []): GoogleProfile
{
    return new GoogleProfile(...array_merge([
        'id' => 'sub-1',
        'email' => 'budi@kantor.test',
        'hostedDomain' => 'kantor.test',
        'emailVerified' => true,
        'name' => 'Budi',
        'avatarUrl' => 'https://lh3.googleusercontent.com/a/budi',
    ], $overrides));
}

function rejectionReason(GoogleProfile $profile): ?string
{
    try {
        app(AuthenticateGoogleUser::class)->handle($profile);
    } catch (LoginRejected $rejected) {
        return $rejected->reason;
    }

    return null;
}

it('rejects with a reason code per rule', function (array $overrides, string $reason) {
    User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);

    expect(rejectionReason(googleProfile($overrides)))->toBe($reason);
})->with([
    'email of another domain' => [['email' => 'budi@gmail.com'], LoginRejected::WRONG_DOMAIN],
    'look-alike suffix' => [['email' => 'budi@evilkantor.test'], LoginRejected::WRONG_DOMAIN],
    'hd of another domain' => [['hostedDomain' => 'lain.test'], LoginRejected::WRONG_DOMAIN],
    'missing hd' => [['hostedDomain' => null], LoginRejected::MISSING_HD],
    'unverified email' => [['emailVerified' => false], LoginRejected::UNVERIFIED_EMAIL],
    'unknown email' => [['email' => 'baru@kantor.test', 'id' => 'sub-2'], LoginRejected::NOT_REGISTERED],
    'empty email' => [['email' => ''], LoginRejected::WRONG_DOMAIN],
]);

it('links the Google identity and records it in the audit trail', function () {
    $user = User::factory()->forCompany($this->company)->create(['email' => 'budi@kantor.test']);

    $result = app(AuthenticateGoogleUser::class)->handle(googleProfile());

    expect($result->is($user))->toBeTrue()
        ->and($user->refresh()->google_id)->toBe('sub-1')
        ->and($user->avatar_url)->toBe('https://lh3.googleusercontent.com/a/budi');

    // Linking google_id is audited (user.updated); avatar_url and last_login_at
    // are bookkeeping excluded from the audit trail (User::auditExclude()).
    $log = AuditLog::query()->where('action', 'user.updated')->sole();
    expect(array_keys($log->new_values ?? []))->toBe(['google_id']);
});

it('keeps the stored avatar when Google sends none', function () {
    $user = User::factory()->forCompany($this->company)->create([
        'email' => 'budi@kantor.test',
        'avatar_url' => 'https://lama.test/a.png',
    ]);

    app(AuthenticateGoogleUser::class)->handle(googleProfile(['avatarUrl' => null]));

    expect($user->refresh()->avatar_url)->toBe('https://lama.test/a.png');
});

it('normalizes a Socialite user into a profile', function () {
    $socialite = (new SocialiteUser)->setRaw([
        'sub' => '42',
        'email' => ' Budi@Kantor.TEST ',
        'email_verified' => 'true',
        'hd' => 'Kantor.Test',
    ])->map(['id' => '42', 'email' => ' Budi@Kantor.TEST ', 'name' => 'Budi', 'avatar' => '']);

    $profile = GoogleProfile::fromSocialite($socialite);

    expect($profile->id)->toBe('42')
        ->and($profile->email)->toBe('budi@kantor.test')
        ->and($profile->hostedDomain)->toBe('kantor.test')
        ->and($profile->emailVerified)->toBeTrue()
        ->and($profile->avatarUrl)->toBeNull();
});
