<?php

namespace App\Concerns;

use App\Domain\Auth\Services\PasswordPolicy;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rules\Password;

/**
 * One password policy for every way a password is chosen (own change, HR,
 * forgot password). The rules depend on the account (PasswordPolicy):
 * employees get "aturan bebas" (not the default password), Super Admins the
 * strict rules (Password::defaults(), not the email, not the default password).
 */
trait PasswordValidationRules
{
    /**
     * Get the validation rules used to validate passwords.
     *
     * @param  User|null  $user  the account whose password is set
     * @return array<int, Password|ValidationRule|array<mixed>|string>
     */
    protected function passwordRules(?User $user): array
    {
        return app(PasswordPolicy::class)->rules($user);
    }

    /**
     * Get the validation rules used to validate the current password.
     *
     * @return array<int, Password|ValidationRule|array<mixed>|string>
     */
    protected function currentPasswordRules(): array
    {
        return ['required', 'string', 'current_password'];
    }
}
