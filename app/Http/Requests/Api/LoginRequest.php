<?php

namespace App\Http\Requests\Api;

use App\Domain\Devices\Enums\DevicePlatform;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/auth/login. Credentials go through the web login mechanism
 * (AuthenticateEmployee), so this request only shapes the device metadata
 * that registers the installation. `device_id_hash` is the SHA-256 of the
 * raw device identifier — the raw value never leaves the phone.
 */
class LoginRequest extends FormRequest
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
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device' => ['required', 'array'],
            'device.platform' => ['required', Rule::enum(DevicePlatform::class)],
            'device.device_id_hash' => ['required', 'string', 'regex:/^[0-9a-fA-F]{64}$/'],
            'device.name' => ['nullable', 'string', 'max:100'],
            'device.os_version' => ['nullable', 'string', 'max:40'],
            'device.app_version' => ['nullable', 'string', 'max:30'],
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
            'device.required' => 'Data perangkat wajib dikirim.',
            'device.array' => 'Data perangkat tidak valid.',
            'device.platform.required' => 'Platform perangkat wajib diisi.',
            'device.platform.Illuminate\Validation\Rules\Enum' => 'Platform perangkat harus android, ios, atau web.',
            'device.device_id_hash.required' => 'Identitas perangkat wajib dikirim.',
            'device.device_id_hash.regex' => 'Identitas perangkat tidak valid.',
            'device.name.max' => 'Nama perangkat maksimal 100 karakter.',
            'device.os_version.max' => 'Versi sistem operasi maksimal 40 karakter.',
            'device.app_version.max' => 'Versi aplikasi maksimal 30 karakter.',
        ];
    }

    // Email & password are read by AuthenticateEmployee straight from the
    // request (same code path as the web login) — no accessors here.

    public function platform(): DevicePlatform
    {
        return DevicePlatform::from($this->string('device.platform')->toString());
    }

    public function deviceIdHash(): string
    {
        return strtolower(trim($this->string('device.device_id_hash')->toString()));
    }

    public function deviceName(): ?string
    {
        return $this->optionalString('device.name', 100);
    }

    public function osVersion(): ?string
    {
        return $this->optionalString('device.os_version', 40);
    }

    public function appVersion(): ?string
    {
        return $this->optionalString('device.app_version', 30);
    }

    /** A present-but-empty optional string is stored as null. */
    private function optionalString(string $key, int $max): ?string
    {
        $value = trim($this->string($key)->toString());

        return $value === '' || strlen($value) > $max ? null : $value;
    }
}
