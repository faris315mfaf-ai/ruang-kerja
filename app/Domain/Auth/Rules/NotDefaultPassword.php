<?php

namespace App\Domain\Auth\Rules;

use App\Domain\Auth\Services\DefaultPassword;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A password an employee chooses (or HR types) may not be the company-wide
 * default password (case-sensitive). No-op while the feature is off.
 */
final readonly class NotDefaultPassword implements ValidationRule
{
    public const string MESSAGE = 'Gunakan sandi selain sandi bawaan.';

    public function __construct(private DefaultPassword $defaultPassword) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($this->defaultPassword->matches($value)) {
            $fail(self::MESSAGE);
        }
    }
}
