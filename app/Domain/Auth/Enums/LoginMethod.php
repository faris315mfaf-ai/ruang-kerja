<?php

namespace App\Domain\Auth\Enums;

use Illuminate\Http\Request;

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
     * Request attribute a login controller/action sets right before `Auth::login()`.
     */
    public const string REQUEST_ATTRIBUTE = 'auth.login_method';

    /**
     * Declares how the login that is about to happen in this request was performed.
     * Only an explicit declaration can yield a TOTP-exempt method (Google, Demo).
     */
    public function declareFor(Request $request): void
    {
        $request->attributes->set(self::REQUEST_ATTRIBUTE, $this);
    }

    /**
     * The method declared for the current request, if any.
     */
    public static function declaredFor(Request $request): ?self
    {
        $declared = $request->attributes->get(self::REQUEST_ATTRIBUTE);

        return $declared instanceof self ? $declared : null;
    }

    /**
     * Resolves the method of a `Login` event. A remember-me restore always wins
     * (it can fire on any route, e.g. the Google callback, before the controller
     * runs); anything undeclared is treated strictly (as password) so the TOTP
     * requirement still applies.
     */
    public static function resolve(?self $declared, bool $viaRemember): self
    {
        if ($viaRemember) {
            return self::Remember;
        }

        return $declared ?? self::Password;
    }
}
