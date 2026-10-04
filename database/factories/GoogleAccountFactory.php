<?php

namespace Database\Factories;

use App\Models\GoogleAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<GoogleAccount>
 */
class GoogleAccountFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'google_id' => (string) fake()->unique()->numerify('1#################'),
            'email' => fake()->unique()->safeEmail(),
            'access_token' => 'ya29.'.Str::random(40),
            'refresh_token' => '1//'.Str::random(40),
            'expires_at' => now()->addHour(),
            'scopes' => ['openid', 'https://www.googleapis.com/auth/userinfo.email', GoogleAccount::DRIVE_FILE_SCOPE],
        ];
    }

    public function expired(): static
    {
        return $this->state(fn (array $attributes) => ['expires_at' => now()->subMinute()]);
    }

    /**
     * Refresh token revoked (invalid_grant): the user must reconnect.
     */
    public function revoked(): static
    {
        return $this->state(fn (array $attributes) => ['refresh_token' => null, 'expires_at' => now()->subMinute()]);
    }

    public function withoutDriveScope(): static
    {
        return $this->state(fn (array $attributes) => ['scopes' => ['openid', 'https://www.googleapis.com/auth/userinfo.email']]);
    }
}
