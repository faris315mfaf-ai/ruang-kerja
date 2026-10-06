<?php

namespace App\Domain\Auth\Data;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Session\Session;

/**
 * What the requesting browser keeps in its session for "Lupa kata sandi": the
 * plain request token (only its hash is in the database), the address typed,
 * when it was requested and — once HR approved — the plain setup token.
 */
final readonly class PasswordResetSession
{
    public const string KEY = 'password_reset_request';

    public function __construct(
        public string $token,
        public string $email,
        public CarbonImmutable $requestedAt,
        public ?string $setupToken = null,
    ) {}

    public static function from(Session $session): ?self
    {
        $data = $session->get(self::KEY);

        if (! is_array($data) || ! is_string($data['token'] ?? null) || ! is_string($data['email'] ?? null) || ! is_int($data['requested_at'] ?? null)) {
            return null;
        }

        $setup = $data['setup_token'] ?? null;

        return new self($data['token'], $data['email'], CarbonImmutable::createFromTimestamp($data['requested_at']), is_string($setup) ? $setup : null);
    }

    public function store(Session $session): void
    {
        $session->put(self::KEY, [
            'token' => $this->token,
            'email' => $this->email,
            'requested_at' => $this->requestedAt->getTimestamp(),
            'setup_token' => $this->setupToken,
        ]);
    }

    public function withSetupToken(?string $token): self
    {
        return new self($this->token, $this->email, $this->requestedAt, $token);
    }

    public static function forget(Session $session): void
    {
        $session->forget(self::KEY);
    }
}
