<?php

namespace App\Domain\Auth\Actions;

use App\Domain\Auth\Enums\LoginMethod;
use App\Domain\Organization\Services\AuditLogger;
use App\Http\Middleware\EnsureActiveEmployee;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\LoginRateLimiter;

/**
 * Fortify `authenticateUsing` callback: email + password is the emergency door
 * for Super Admins only (PRD M1). Everyone else signs in with Google.
 *
 * Messages never reveal whether an address exists: a wrong email/password gets
 * the generic message; only someone who knows the correct password learns that
 * the account must use Google. TOTP is then enforced by Fortify's two-factor
 * challenge (when confirmed) or `EnsureTwoFactorForSuperAdmin` (setup forced).
 */
final class AuthenticateSuperAdmin
{
    public const string INVALID_CREDENTIALS = 'Email atau kata sandi salah. Karyawan masuk dengan tombol Masuk dengan Google.';

    public const string USE_GOOGLE = 'Gunakan tombol Masuk dengan Google.';

    /** Fortify calls the callback twice on success (2FA check, then login). */
    private const string REQUEST_CACHE_KEY = 'auth.super_admin_user';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly LoginRateLimiter $limiter,
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

        /** @var array{0: User|null, 1: bool} $result */
        $result = (new Timebox)->call(fn (): array => $this->check($email, $password), 200_000);

        [$user, $valid] = $result;

        if ($user === null || ! $valid) {
            if ($user?->isSuperAdmin()) {
                $this->logFailure($user, 'invalid_credentials');
            }

            $this->reject($request, self::INVALID_CREDENTIALS);
        }

        if (! $user->isActive()) {
            if ($user->isSuperAdmin()) {
                $this->logFailure($user, 'inactive');
            }

            $this->reject($request, EnsureActiveEmployee::MESSAGE);
        }

        if (! $user->isSuperAdmin()) {
            $this->reject($request, self::USE_GOOGLE);
        }

        $request->attributes->set(self::REQUEST_CACHE_KEY, $user);
        LoginMethod::Password->declareFor($request);

        return $user;
    }

    /**
     * @return array{0: User|null, 1: bool}
     */
    private function check(string $email, string $password): array
    {
        $user = $email === '' ? null : User::query()->whereRaw('lower(email) = ?', [$email])->first();

        $valid = $user !== null
            && $user->password !== null
            && $password !== ''
            && Hash::check($password, $user->password);

        return [$user, $valid];
    }

    private function logFailure(User $user, string $reason): void
    {
        $this->audit->log('user.login_failed', $user, null, [
            'method' => LoginMethod::Password->value,
            'reason' => $reason,
        ]);
    }

    /**
     * @throws ValidationException
     */
    private function reject(Request $request, string $message): never
    {
        $this->limiter->increment($request);

        throw ValidationException::withMessages(['email' => $message]);
    }
}
