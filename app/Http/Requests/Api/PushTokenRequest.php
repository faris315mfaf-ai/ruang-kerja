<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * PUT /api/v1/perangkat/{device}/push-token — registers (or rotates) the FCM
 * token of the caller's own installation. Clearing is not a separate flow:
 * a token dies with logout, re-login or revoking the device.
 */
class PushTokenRequest extends FormRequest
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
            // FCM registration tokens are ~150–200 ASCII characters; the
            // column (devices.push_token) holds 255.
            'token' => ['required', 'string', 'min:32', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'token.required' => 'Token push wajib dikirim.',
            'token.string' => 'Token push tidak valid.',
            'token.min' => 'Token push tidak valid.',
            'token.max' => 'Token push maksimal 255 karakter.',
        ];
    }

    public function token(): string
    {
        return trim($this->string('token')->toString());
    }
}
