<?php

namespace App\Http\Requests\Auth;

use App\Concerns\PasswordValidationRules;
use App\Domain\Auth\Data\PasswordResetSession;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Lupa kata sandi" › Sandi baru. The same password policy as everywhere else
 * (PasswordPolicy), for the account of the approved request.
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
            'password' => $this->passwordRules($this->account()),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['password' => 'kata sandi'];
    }

    private function account(): ?User
    {
        $token = PasswordResetSession::from($this->session())?->setupToken;

        if ($token === null) {
            return null;
        }

        return PasswordResetRequest::query()
            ->where('setup_token_hash', PasswordResetRequest::hashToken($token))
            ->first()
            ?->user;
    }
}
