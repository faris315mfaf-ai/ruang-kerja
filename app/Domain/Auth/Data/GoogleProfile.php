<?php

namespace App\Domain\Auth\Data;

use Illuminate\Support\Str;
use Laravel\Socialite\AbstractUser;

/**
 * The parts of a Google OpenID profile the login flow relies on.
 */
final readonly class GoogleProfile
{
    public function __construct(
        public string $id,
        public string $email,
        public ?string $hostedDomain,
        public bool $emailVerified,
        public ?string $name = null,
        public ?string $avatarUrl = null,
    ) {}

    public static function fromSocialite(AbstractUser $user): self
    {
        $raw = $user->getRaw();

        $hd = $raw['hd'] ?? null;
        $verified = $raw['email_verified'] ?? false;
        $avatar = $user->getAvatar();
        $name = $user->getName();

        return new self(
            id: (string) $user->getId(),
            email: Str::lower(trim((string) $user->getEmail())),
            hostedDomain: is_string($hd) && trim($hd) !== '' ? Str::lower(trim($hd)) : null,
            // Google returns a boolean; older endpoints returned the string "true".
            emailVerified: $verified === true || $verified === 'true',
            name: is_string($name) ? $name : null,
            avatarUrl: is_string($avatar) && $avatar !== '' ? $avatar : null,
        );
    }
}
