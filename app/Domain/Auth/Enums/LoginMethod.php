<?php

namespace App\Domain\Auth\Enums;

/**
 * How the current session was authenticated (stored in the session as `auth.method`).
 */
enum LoginMethod: string
{
    case Google = 'google';
    case Password = 'password';
    case Demo = 'demo';
    case Remember = 'remember';

    public const string SESSION_KEY = 'auth.method';

    public function label(): string
    {
        return match ($this) {
            self::Google => 'Google Workspace',
            self::Password => 'Email & kata sandi',
            self::Demo => 'Login demo lokal',
            self::Remember => 'Sesi diingat',
        };
    }

    /**
     * Derives the method from the route that triggered the `Login` event.
     */
    public static function fromRoute(?string $routeName, bool $remember): self
    {
        return match ($routeName) {
            'auth.google.callback' => self::Google,
            'login.demo' => self::Demo,
            'login.store', 'two-factor.login.store' => self::Password,
            // Remember-me recall happens on any page; anything unknown is treated
            // strictly (as password) so the TOTP requirement still applies.
            default => $remember ? self::Remember : self::Password,
        };
    }
}
