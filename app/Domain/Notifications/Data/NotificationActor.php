<?php

namespace App\Domain\Notifications\Data;

use App\Models\User;

/**
 * Who caused the notification (shown as avatar + bold name).
 */
final readonly class NotificationActor
{
    public function __construct(
        public string $id,
        public string $name,
        public ?string $avatar = null,
    ) {}

    public static function fromUser(User $user): self
    {
        $avatar = $user->getAttribute('avatar_url');

        return new self($user->id, $user->name, is_string($avatar) ? $avatar : null);
    }

    /**
     * @return array{id: string, name: string, avatar: string|null}
     */
    public function toArray(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'avatar' => $this->avatar];
    }
}
