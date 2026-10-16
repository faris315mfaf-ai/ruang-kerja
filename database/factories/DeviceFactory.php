<?php

namespace Database\Factories;

use App\Domain\Devices\Enums\DevicePlatform;
use App\Domain\Devices\Models\Device;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Device>
 */
class DeviceFactory extends Factory
{
    protected $model = Device::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'company_id' => fn (array $attributes): string => (string) User::query()->whereKey((string) $attributes['user_id'])->value('company_id'),
            'platform' => DevicePlatform::Android,
            'device_id_hash' => hash('sha256', fake()->unique()->uuid()),
            'name' => fake()->randomElement(['Pixel 8', 'Samsung Galaxy A54', 'Xiaomi Redmi Note 13']),
            'os_version' => 'Android 15',
            'app_version' => '1.0.0',
            'push_token' => fake()->unique()->regexify('[A-Za-z0-9_-]{120}'),
            'integrity_verdict' => null,
            'last_seen_at' => now(),
            'biometric_login' => false,
            'is_trusted' => false,
        ];
    }

    /**
     * A device without an FCM token (push never granted or revoked).
     */
    public function withoutPushToken(): static
    {
        return $this->state(fn (): array => ['push_token' => null]);
    }

    /**
     * A browser installation (PWA) instead of an Android phone.
     */
    public function web(): static
    {
        return $this->state(fn (): array => ['platform' => DevicePlatform::Web, 'name' => 'Chrome di Windows']);
    }
}
