<?php

namespace App\Domain\Organization\Rules;

use App\Models\Company;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * The email must belong to the company's Google Workspace domain (exact suffix
 * match, case-insensitive), because employees sign in with Google.
 */
final readonly class CompanyEmail implements ValidationRule
{
    public function __construct(private Company $company) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! $this->company->ownsEmail($value)) {
            $fail(self::message($this->company));
        }
    }

    public static function message(Company $company): string
    {
        return "Email harus memakai domain kantor @{$company->google_domain}.";
    }
}
