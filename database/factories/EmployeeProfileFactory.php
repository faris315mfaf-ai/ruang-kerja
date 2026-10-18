<?php

namespace Database\Factories;

use App\Models\EmployeeProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmployeeProfile>
 */
class EmployeeProfileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'employee_number' => fake()->unique()->numerify('EMP-#####'),
            'nik' => fake()->numerify('################'),
            'phone' => fake()->numerify('+62812########'),
            'birth_date' => fake()->dateTimeBetween('-50 years', '-20 years')->format('Y-m-d'),
            'address' => fake()->address(),
            'emergency_contact' => [
                'name' => fake()->name(),
                'relation' => 'Keluarga',
                'phone' => fake()->numerify('+62813########'),
            ],
            // The user's company (employee numbers are unique per company).
            'company_id' => fn (array $attributes): mixed => User::query()->whereKey($attributes['user_id'])->value('company_id'),
        ];
    }
}
