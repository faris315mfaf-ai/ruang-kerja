<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\HasDevicePayload;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /api/v1/auth/login. Credentials go through the web login mechanism
 * (AuthenticateEmployee), so this request only shapes the device metadata
 * that registers the installation (HasDevicePayload).
 *
 * `supports_password_change` (optional boolean): the app can run the forced
 * password change itself (POST /auth/sandi). Without it an account that must
 * change its password is refused with 403 `password_change_required`, as
 * before; with it the sign-in succeeds and the response says
 * `password_change_required: true`.
 */
class LoginRequest extends FormRequest
{
    use HasDevicePayload;

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
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'supports_password_change' => ['sometimes', 'boolean'],
            ...$this->deviceRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Kata sandi wajib diisi.',
            'supports_password_change.boolean' => 'Nilai supports_password_change harus true atau false.',
            ...$this->deviceMessages(),
        ];
    }

    // Email & password are read by AuthenticateEmployee straight from the
    // request (same code path as the web login) — no accessors here.

    public function supportsPasswordChange(): bool
    {
        return $this->boolean('supports_password_change');
    }
}
