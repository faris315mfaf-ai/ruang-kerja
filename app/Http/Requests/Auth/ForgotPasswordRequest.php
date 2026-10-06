<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

/**
 * "Lupa kata sandi" form (guests). Only the format is validated: whether the
 * address belongs to someone is never revealed.
 */
class ForgotPasswordRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:190'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['email' => 'email'];
    }

    public function email(): string
    {
        return Str::lower(trim($this->string('email')->toString()));
    }
}
