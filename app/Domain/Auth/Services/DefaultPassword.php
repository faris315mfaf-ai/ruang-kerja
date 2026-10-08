<?php

namespace App\Domain\Auth\Services;

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Illuminate\Container\Attributes\Scoped;
use Illuminate\Support\Facades\Hash;
use LogicException;

/**
 * Company-wide default password for employee accounts (owner decision
 * 7 Oct 2026, `EMPLOYEE_DEFAULT_PASSWORD`, config `auth.employee_default_password`).
 * Empty = feature off. New employees (form, import), HR's "Sandi bawaan" and
 * `ruangkerja:reset-default-passwords` set it, always with "wajib ganti saat
 * login berikutnya". Never for accounts holding super_admin/direksi/hr
 * (audit R-06, owner decision 8 Oct 2026): the shared value is known to every
 * employee, so it must not guard those accounts — their password is set by a
 * Super Admin or by the owner through "Lupa kata sandi". The value is never
 * logged or audited; employees may not choose it as their own password.
 *
 * Scoped: the bcrypt hash is computed once per request / job / command, so an
 * import or a mass reset does not pay the hashing cost per account. The value
 * is shared by design, so a shared salt reveals nothing the value does not.
 */
#[Scoped]
final class DefaultPassword
{
    /** @var array{for: string, hash: string}|null */
    private ?array $memo = null;

    public function enabled(): bool
    {
        return $this->value() !== null;
    }

    /**
     * The configured value, or null when the feature is off.
     */
    public function value(): ?string
    {
        $value = config('auth.employee_default_password');

        return is_string($value) && trim($value) !== '' ? $value : null;
    }

    /**
     * Whether this account may receive the default password.
     */
    public function appliesTo(User $user): bool
    {
        return $this->enabled() && ! $user->hasAnyRole(Role::superAdminSetsPassword());
    }

    /**
     * Case-sensitive, constant-time comparison with the configured value.
     */
    public function matches(#[\SensitiveParameter] mixed $candidate): bool
    {
        $value = $this->value();

        return $value !== null && is_string($candidate) && hash_equals($value, $candidate);
    }

    /**
     * A bcrypt hash of the value, ready for the `hashed` cast.
     *
     * @throws LogicException when the feature is off
     */
    public function hash(): string
    {
        $value = $this->value() ?? throw new LogicException('EMPLOYEE_DEFAULT_PASSWORD is not configured.');
        $fingerprint = hash('sha256', $value);

        if ($this->memo === null || ! hash_equals($this->memo['for'], $fingerprint)) {
            $this->memo = ['for' => $fingerprint, 'hash' => Hash::make($value)];
        }

        return $this->memo['hash'];
    }
}
