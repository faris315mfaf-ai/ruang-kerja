<?php

namespace App\Domain\Auth\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Str;

/**
 * A password may not be the account's email address or its local part
 * ("dimas.pratama@…" → "dimas.pratama"), compared case-insensitively.
 */
final readonly class NotSameAsEmail implements ValidationRule
{
    public const string MESSAGE = 'Kata sandi tidak boleh sama dengan alamat email.';

    public function __construct(private ?string $email) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($this->email === null || ! is_string($value)) {
            return;
        }

        $email = Str::lower(trim($this->email));
        $password = Str::lower(trim($value));

        if ($password === '' || $email === '') {
            return;
        }

        if ($password === $email || $password === Str::before($email, '@')) {
            $fail(self::MESSAGE);
        }
    }
}
