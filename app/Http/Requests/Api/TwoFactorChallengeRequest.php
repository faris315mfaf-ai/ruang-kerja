<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/auth/dua-faktor — finishes a TOTP sign-in. Exactly one of
 * `code` (6-digit authenticator code) or `recovery_code` is needed.
 */
class TwoFactorChallengeRequest extends FormRequest
{
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
            'challenge_token' => ['required', 'string', 'max:200'],
            'code' => ['nullable', 'string', 'max:20', 'required_without:recovery_code'],
            'recovery_code' => ['nullable', 'string', 'max:100', 'required_without:code'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'challenge_token.required' => 'Token tantangan wajib dikirim.',
            'code.required_without' => 'Masukkan kode autentikator atau kode pemulihan.',
            'recovery_code.required_without' => 'Masukkan kode autentikator atau kode pemulihan.',
        ];
    }

    public function challengeToken(): string
    {
        return $this->string('challenge_token')->toString();
    }

    public function code(): ?string
    {
        $code = preg_replace('/\s+/', '', $this->string('code')->toString());

        return $code === null || $code === '' ? null : $code;
    }

    public function recoveryCode(): ?string
    {
        $code = trim($this->string('recovery_code')->toString());

        return $code === '' ? null : $code;
    }
}
