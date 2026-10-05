<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Data\GoogleProfile;
use App\Domain\Auth\Exceptions\LoginRejected;
use App\Models\Company;
use App\Models\User;

/**
 * Resolves the employee for a Google sign-in, or refuses it.
 *
 * Rules (PRD M1): the `hd` claim AND the email suffix must both equal
 * `companies.google_domain`; only employees registered by HR and still active
 * may enter. On success the Google identity is linked (`google_id`,
 * `avatar_url`, verified email). `last_login_at` is stamped by the `Login`
 * listener for every sign-in method.
 */
final class AuthenticateGoogleUser
{
    /**
     * @throws LoginRejected
     */
    public function handle(GoogleProfile $profile): User
    {
        $email = $profile->email;

        if ($email === '' || ! str_contains($email, '@') || $profile->id === '') {
            throw LoginRejected::wrongDomain($email === '' ? null : $email);
        }

        if ($profile->hostedDomain === null) {
            throw LoginRejected::missingHostedDomain($email);
        }

        $company = Company::query()->where('google_domain', $profile->hostedDomain)->first();

        if ($company === null || ! $company->ownsEmail($email)) {
            throw LoginRejected::wrongDomain($email);
        }

        if (! $profile->emailVerified) {
            throw LoginRejected::unverifiedEmail($email);
        }

        $user = $this->findUser($company, $profile);

        if ($user === null) {
            throw LoginRejected::notRegistered($email);
        }

        if (! $user->isActive()) {
            throw LoginRejected::inactive($email);
        }

        $user->forceFill([
            // A Workspace account re-created with the same address gets a new `sub`;
            // the domain check above proves the company controls it, so relink.
            'google_id' => $profile->id,
            'avatar_url' => $profile->avatarUrl ?? $user->avatar_url,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        return $user;
    }

    /**
     * Match by the stable Google subject first, then by the HR-registered email.
     */
    private function findUser(Company $company, GoogleProfile $profile): ?User
    {
        // google_id is globally unique: a match in another company is never ours.
        $byGoogleId = User::query()->where('google_id', $profile->id)->first();

        if ($byGoogleId !== null) {
            return $byGoogleId->company_id === $company->id ? $byGoogleId : null;
        }

        return User::query()
            ->where('company_id', $company->id)
            ->whereRaw('lower(email) = ?', [$profile->email])
            ->first();
    }
}
