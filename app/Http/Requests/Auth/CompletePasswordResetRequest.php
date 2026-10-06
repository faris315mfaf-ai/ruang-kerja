<?php

namespace App\Http\Requests\Auth;

use App\Concerns\PasswordValidationRules;
use App\Domain\Auth\Data\PasswordResetSession;
use App\Models\PasswordResetRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Lupa kata sandi" › Sandi baru. The same password policy as everywhere else,
 * including "not the account's email" (the address of the approved request).
 */
class CompletePasswordResetRequest extends FormRequest
{
    use PasswordValidationRules;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'password' => $this->passwordRules($this->accountEmail()),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['password' => 'kata sandi'];
    }

    private function accountEmail(): ?string
    {
        $token = PasswordResetSession::from($this->session())?->setupToken;

        if ($token === null) {
            return null;
        }

        $email = PasswordResetRequest::query()
            ->where('setup_token_hash', PasswordResetRequest::hashToken($token))
            ->value('email');

        return is_string($email) ? $email : null;
    }
}
