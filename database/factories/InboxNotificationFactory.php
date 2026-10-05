<?php

namespace Database\Factories;

use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Inbox rows for tests and demo data (real notifications go through BaseNotification).
 *
 * @extends Factory<InboxNotification>
 */
class InboxNotificationFactory extends Factory
{
    protected $model = InboxNotification::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'type' => NotificationType::SystemAnnouncement->value,
            'notifiable_type' => (new User)->getMorphClass(),
            'notifiable_id' => User::factory(),
            'data' => [
                'type' => NotificationType::SystemAnnouncement->value,
                'title' => fake()->sentence(4),
                'body' => fake()->sentence(10),
                'url' => '/dashboard',
                'actor' => null,
                'subject' => null,
                'meta' => [],
            ],
            'action_required' => false,
            'read_at' => null,
            'archived_at' => null,
        ];
    }

    public function recipient(User $user): static
    {
        return $this->state(fn () => ['notifiable_id' => $user->id]);
    }

    public function ofType(NotificationType $type): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => $type->value,
            'data' => [...$attributes['data'], 'type' => $type->value],
            'action_required' => $type->requiresAction(),
        ]);
    }

    public function read(): static
    {
        return $this->state(fn () => ['read_at' => now()]);
    }

    public function archived(): static
    {
        return $this->state(fn () => ['archived_at' => now(), 'read_at' => now()]);
    }

    public function needsAction(): static
    {
        return $this->state(fn () => ['action_required' => true, 'resolved_at' => null]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function withData(array $data): static
    {
        return $this->state(fn (array $attributes) => ['data' => [...$attributes['data'], ...$data]]);
    }
}
