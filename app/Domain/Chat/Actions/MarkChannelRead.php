<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Notifications\Enums\NotificationType;
use App\Events\Chat\ChannelRead;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\InboxNotification;
use App\Models\User;

/**
 * Moves the member's read pointer to the newest message (never backwards)
 * and marks the Obrolan notifications of this channel as read. Non-members
 * (e.g. Direksi reading a workspace channel) keep no pointer.
 * Returns the new pointer, or null when nothing changed.
 */
final class MarkChannelRead
{
    public function handle(Channel $channel, User $user): ?string
    {
        $latest = $channel->messages()->withTrashed()->max('id');

        if (! is_string($latest)) {
            return null;
        }

        $updated = ChannelMember::query()
            ->where('channel_id', $channel->id)
            ->where('user_id', $user->id)
            ->where(fn ($query) => $query->whereNull('last_read_message_id')->orWhere('last_read_message_id', '<', $latest))
            ->update(['last_read_message_id' => $latest, 'updated_at' => now()]);

        InboxNotification::query()
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->id)
            ->whereNull('read_at')
            ->where(function ($query) use ($channel): void {
                $query->where(fn ($direct) => $direct
                    ->where('type', NotificationType::ChatMessage->value)
                    ->where('subject_type', $channel->getMorphClass())
                    ->where('subject_id', $channel->id))
                    ->orWhere('data->meta->channel_id', $channel->id);
            })
            ->update(['read_at' => now()]);

        if ($updated === 0) {
            return null;
        }

        ChannelRead::dispatch($channel, ['user_id' => $user->id, 'last_read_message_id' => $latest]);

        return $latest;
    }
}
