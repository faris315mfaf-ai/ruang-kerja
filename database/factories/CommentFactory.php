<?php

namespace Database\Factories;

use App\Models\Comment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Bypasses PostComment (no mentions, notifications or events).
 *
 * @extends Factory<Comment>
 */
class CommentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $text = fake()->sentence(8);

        return [
            'commentable_type' => (new Task)->getMorphClass(),
            'commentable_id' => Task::factory(),
            'user_id' => User::factory(),
            'body' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]],
            'body_text' => $text,
        ];
    }

    public function on(Task $task): static
    {
        return $this->state(fn (): array => [
            'commentable_type' => $task->getMorphClass(),
            'commentable_id' => $task->id,
        ]);
    }

    public function by(User $user): static
    {
        return $this->state(fn (): array => ['user_id' => $user->id]);
    }
}
