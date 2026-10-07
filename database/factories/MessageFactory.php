<?php

namespace Database\Factories;

use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses PostMessage (no mentions, notifications or events).
 *
 * @extends Factory<Message>
 */
class MessageFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $text = fake()->sentence(8);

        return [
            'channel_id' => Channel::factory(),
            'user_id' => User::factory(),
            'body' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]],
            'body_text' => $text,
        ];
    }

    public function in(Channel $channel): static
    {
        return $this->state(fn (): array => ['channel_id' => $channel->id]);
    }

    public function by(User $user): static
    {
        return $this->state(fn (): array => ['user_id' => $user->id]);
    }

    public function replyTo(Message $parent): static
    {
        return $this->state(fn (): array => ['channel_id' => $parent->channel_id, 'parent_id' => $parent->id]);
    }
}
