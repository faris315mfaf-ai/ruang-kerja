<?php

namespace App\Domain\Auth\Services;

use App\Domain\Auth\Rules\NotDefaultPassword;
use App\Domain\Auth\Rules\NotSameAsEmail;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rules\Password;

/**
 * Rules for a password someone chooses (owner decision 7 Oct 2026):
 *
 * - employees: "aturan bebas" — required, confirmed, at most 255 characters
 *   and not the company default password (no length/strength rules);
 * - Super Admins: the strict rules — Password::defaults() (min 8, production
 *   also rejects breached passwords), not the email, not the default password.
 *
 * Used for the own change (Pengaturan › Keamanan, also the forced change after
 * the first login), "Lupa kata sandi" › Sandi baru and HR's "Ketik sendiri".
 * `$user` is the account whose password is set; null = unknown (employee rules).
 */
final readonly class PasswordPolicy
{
    public function __construct(private DefaultPassword $defaultPassword) {}

    public function strict(?User $user): bool
    {
        return $user?->isSuperAdmin() === true;
    }

    /**
     * @return array<int, Password|ValidationRule|string>
     */
    public function rules(?User $user): array
    {
        $rules = ['required', 'string', 'max:255'];

        if ($this->strict($user)) {
            $rules[] = Password::default();
            $rules[] = new NotSameAsEmail($user?->email);
        }

        $rules[] = new NotDefaultPassword($this->defaultPassword);
        $rules[] = 'confirmed';

        return $rules;
    }

    /**
     * The `passwordrules` attribute for the browser's password generator:
     * only for Super Admins, so the browser neither enforces nor suggests
     * strength rules to employees.
     */
    public function browserRules(?User $user): ?string
    {
        return $this->strict($user) ? Password::defaults()->toPasswordRulesString() : null;
    }

    /**
     * One-line hint shown above / below the new-password fields.
     */
    public function hint(?User $user): string
    {
        if ($this->strict($user)) {
            return 'Minimal 8 karakter dan tidak sama dengan alamat email.';
        }

        return $this->defaultPassword->enabled()
            ? 'Bebas, asal bukan kata sandi bawaan perusahaan.'
            : 'Bebas, pilih yang mudah Anda ingat.';
    }
}
