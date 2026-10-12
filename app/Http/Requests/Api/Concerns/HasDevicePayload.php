<?php

namespace App\Http\Requests\Api\Concerns;

use App\Domain\Devices\Enums\DevicePlatform;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * The `device` object every request that can end in a new app sign-in carries
 * (login and the end of "Lupa kata sandi"): it registers the installation. The
 * `device_id_hash` is the SHA-256 of the raw device identifier — the raw value
 * never leaves the phone.
 */
trait HasDevicePayload
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function deviceRules(): array
    {
        return [
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
    protected function deviceMessages(): array
    {
        return [
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

    /**
     * The validated device as the plain array ApiSignIn and the 2FA challenge
     * carry around.
     *
     * @return array{platform: string, device_id_hash: string, name: string|null, os_version: string|null, app_version: string|null}
     */
    public function devicePayload(): array
    {
        return [
            'platform' => $this->platform()->value,
            'device_id_hash' => $this->deviceIdHash(),
            'name' => $this->deviceName(),
            'os_version' => $this->osVersion(),
            'app_version' => $this->appVersion(),
        ];
    }

    /** A present-but-empty optional string is stored as null. */
    private function optionalString(string $key, int $max): ?string
    {
        $value = trim($this->string($key)->toString());

        return $value === '' || strlen($value) > $max ? null : $value;
    }
}
