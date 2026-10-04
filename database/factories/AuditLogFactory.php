<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditLog>
 */
class AuditLogFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => null,
            'action' => 'user.updated',
            'auditable_type' => null,
            'auditable_id' => null,
            'old_values' => null,
            'new_values' => null,
            'ip_address' => fake()->ipv4(),
            'user_agent' => 'Mozilla/5.0',
        ];
    }

    public function by(User $actor): static
    {
        return $this->state(fn (): array => ['user_id' => $actor->id]);
    }

    public function forSubject(User $subject): static
    {
        return $this->state(fn (): array => [
            'auditable_type' => $subject->getMorphClass(),
            'auditable_id' => $subject->id,
        ]);
    }
}
