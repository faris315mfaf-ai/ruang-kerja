<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * PATCH /api/v1/perangkat/{device}/biometrik — "Buka dengan sidik jari" on/off.
 */
class BiometricRequest extends FormRequest
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
            'enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'enabled.required' => 'Pilihan aktif atau nonaktif wajib dikirim.',
            'enabled.boolean' => 'Pilihan aktif atau nonaktif tidak valid.',
        ];
    }

    public function enabled(): bool
    {
        return $this->boolean('enabled');
    }
}
