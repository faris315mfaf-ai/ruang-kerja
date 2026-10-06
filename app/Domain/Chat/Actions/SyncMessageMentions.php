<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Notifications\ChatMentionNotification;
use App\Domain\Chat\Services\ChannelAudience;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

/**
 * Rebuilds the `mentions` rows of a message and notifies people mentioned for
 * the first time (once per message and person, also when editing, like
 * SyncMentions for comments). Only people who can read the channel are kept;
 * the author never notifies themselves. Returns the notified ids.
 */
final class SyncMessageMentions
{
    public function __construct(
        private readonly ChannelAudience $audience,
        private readonly NotificationDispatchLog $dispatchLog,
    ) {}

    /**
     * @param  list<string>  $mentionedIds
     * @return list<string>
     */
    public function handle(Channel $channel, Message $message, User $actor, array $mentionedIds): array
    {
        $allowed = $this->audience->withAccess($channel, $mentionedIds);
        $allowedIds = $allowed->pluck('id')->all();

        /** @var list<string> $existing */
        $existing = $message->mentions()->pluck('mentioned_user_id')->all();
        $message->mentions()->whereNotIn('mentioned_user_id', $allowedIds)->delete();

        $new = $allowed->filter(fn (User $user): bool => ! in_array($user->id, $existing, true));

        foreach ($new as $user) {
            $message->mentions()->create([
                'mentioned_user_id' => $user->id,
                'created_by' => $actor->id,
                'created_at' => now(),
            ]);
        }

        $recipients = $new
            ->filter(fn (User $user): bool => $user->id !== $actor->id
                && $this->dispatchLog->claim($user, NotificationType::Mention, $message, 'once'))
            ->values();

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients->all(), new ChatMentionNotification($channel, $message, $actor));
        }

        /** @var list<string> */
        return $recipients->pluck('id')->values()->all();
    }
}
