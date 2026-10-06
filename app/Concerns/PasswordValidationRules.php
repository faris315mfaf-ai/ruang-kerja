<?php

namespace App\Concerns;

use App\Domain\Auth\Rules\NotSameAsEmail;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rules\Password;

/**
 * One password policy for every way a password is set (own change, HR, forgot
 * password): Password::defaults() (min 8; production also rejects breached
 * passwords) and never the account's email address.
 */
trait PasswordValidationRules
{
    /**
     * Get the validation rules used to validate passwords.
     *
     * @return array<int, Password|ValidationRule|array<mixed>|string>
     */
    protected function passwordRules(?string $email = null): array
    {
        return ['required', 'string', 'max:255', Password::default(), new NotSameAsEmail($email), 'confirmed'];
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
