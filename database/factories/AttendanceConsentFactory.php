<?php

namespace Database\Factories;

use App\Domain\Attendance\Enums\ConsentType;
use App\Domain\Attendance\Models\AttendanceConsent;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AttendanceConsent>
 */
class AttendanceConsentFactory extends Factory
{
    protected $model = AttendanceConsent::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => ConsentType::Location,
            'version' => AttendanceConsent::currentVersion(),
            'granted_at' => now(),
            'revoked_at' => null,
        ];
    }
}
