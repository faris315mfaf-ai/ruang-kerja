<?php

namespace App\Http\Requests\Api;

use App\Concerns\PasswordValidationRules;
use App\Http\Requests\Api\Concerns\HasDevicePayload;
use App\Models\PasswordResetRequest;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/auth/lupa-sandi/selesai — the new password after HR approved
 * the request. Same password policy as everywhere (PasswordPolicy), for the
 * account behind the setup token; `device` registers the installation that is
 * signed in at the end.
 */
class CompletePasswordResetRequest extends FormRequest
{
    use HasDevicePayload;
    use PasswordValidationRules;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'setup_token' => ['required', 'string', 'max:200'],
            'password' => $this->passwordRules($this->account()),
            ...$this->deviceRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['password' => 'kata sandi'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'setup_token.required' => 'Token pengaturan kata sandi wajib dikirim.',
            ...$this->deviceMessages(),
        ];
    }

    public function setupToken(): string
    {
        return $this->string('setup_token')->toString();
    }

    private function account(): ?User
    {
        $token = $this->input('setup_token');

        if (! is_string($token) || $token === '') {
            return null;
        }

        return PasswordResetRequest::query()
            ->where('setup_token_hash', PasswordResetRequest::hashToken($token))
            ->first()
            ?->user;
    }
}
