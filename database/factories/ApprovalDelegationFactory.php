<?php

namespace Database\Factories;

use App\Models\ApprovalDelegation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ApprovalDelegation>
 */
class ApprovalDelegationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'delegator_id' => User::factory(),
            'delegate_id' => User::factory(),
            'starts_on' => now()->toDateString(),
            'ends_on' => now()->addDays(5)->toDateString(),
            'reason' => 'Cuti',
        ];
    }
}
