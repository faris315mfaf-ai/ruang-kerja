<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Auth\Services\DefaultPassword;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\LoginRateLimiter;

/**
 * Fortify `authenticateUsing` callback: every active employee signs in with
 * email + password (owner decision 6 Oct 2026; Google sign-in is on hold).
 *
 * Every failure — unknown address, wrong password, no password set yet, inactive
 * account — gets the same message inside the same 200 ms timebox, so the form
 * never reveals whether an address belongs to someone. Failures of known
 * accounts are audited (`user.login_failed`) and count towards the `login`
 * limiter. Super Admins then pass Fortify's TOTP challenge (or the forced setup,
 * EnsureTwoFactorForSuperAdmin); nobody else needs 2FA. Signing in with the
 * company default password always sets "wajib ganti" (EnsurePasswordChanged).
 */
final class AuthenticateEmployee
{
    public const string INVALID_CREDENTIALS = 'Email atau kata sandi salah. Belum punya kata sandi? Hubungi HR atau pakai Lupa kata sandi.';

    /** Fortify calls the callback twice on success (2FA check, then login). */
    private const string REQUEST_CACHE_KEY = 'auth.password_user';

    private const int TIMEBOX_MICROSECONDS = 200_000;

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly LoginRateLimiter $limiter,
        private readonly DefaultPassword $defaultPassword,
    ) {}

    /**
     * @throws ValidationException
     */
    public function handle(Request $request): User
    {
        $cached = $request->attributes->get(self::REQUEST_CACHE_KEY);

        if ($cached instanceof User) {
            return $cached;
        }

        $email = Str::lower(trim($request->string('email')->value()));
        $password = $request->string('password')->value();

        /** @var array{0: User|null, 1: string|null} $result */
        $result = app(Timebox::class)->call(fn (): array => $this->check($email, $password), self::TIMEBOX_MICROSECONDS);

        [$user, $failure] = $result;

        if ($user === null || $failure !== null) {
            if ($user !== null) {
                $this->audit->log('user.login_failed', $user, null, [
                    'method' => LoginMethod::Password->value,
                    'reason' => $failure,
                ]);
            }

            $this->limiter->increment($request);

            throw ValidationException::withMessages(['email' => self::INVALID_CREDENTIALS]);
        }

        $this->requireChangeOfDefaultPassword($user, $password);

        $request->attributes->set(self::REQUEST_CACHE_KEY, $user);
        LoginMethod::Password->declareFor($request);

        return $user;
    }

    /**
     * The account (if any) and the reason the sign-in fails (null = success).
     * The password hash is always checked, even for an unknown address.
     *
     * @return array{0: User|null, 1: string|null}
     */
    private function check(string $email, string $password): array
    {
        $user = $email === '' ? null : User::query()->whereRaw('lower(email) = ?', [$email])->first();

        if ($user === null || $user->password === null) {
            // Same work as a real check, so timing does not depend on the account.
            Hash::check($password, self::dummyHash());

            return [$user, $user === null ? 'unknown' : 'no_password'];
        }

        if ($password === '' || ! Hash::check($password, $user->password)) {
            return [$user, 'invalid_credentials'];
        }

        if (! $user->isActive()) {
            return [$user, 'inactive'];
        }

        return [$user, null];
    }

    /**
     * Safety net (audit rapat 2026-10, R-01): whoever signs in with the
     * company-wide default password must replace it (EnsurePasswordChanged),
     * even when the account lost its "wajib ganti" flag somehow.
     */
    private function requireChangeOfDefaultPassword(User $user, #[\SensitiveParameter] string $password): void
    {
        if ($user->password_change_required || ! $this->defaultPassword->appliesTo($user) || ! $this->defaultPassword->matches($password)) {
            return;
        }

        $user->forceFill(['password_change_required' => true])->saveQuietly();
    }

    private static function dummyHash(): string
    {
        static $hash = null;

        return $hash ??= Hash::make(Str::random(32));
    }
}
