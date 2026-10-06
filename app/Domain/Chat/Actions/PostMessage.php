<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Notifications\DirectMessageNotification;
use App\Domain\Chat\Services\ChannelMembership;
use App\Domain\Chat\Services\ChatRichText;
use App\Domain\Notifications\Enums\NotificationType;
use App\Events\Chat\ChatActivity;
use App\Events\Chat\MessagePosted;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\InboxNotification;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Sends a message (or a thread reply): sanitized Tiptap JSON → Drive
 * attachments → mentions (+ notifications) → the author has read up to it →
 * DM/group members get "Pesan baru" (decision 6 Oct 2026: only DMs/groups and
 * mentions notify; muted DMs only on mention) → MessagePosted + ChatActivity.
 * Posting in a public channel joins it.
 */
final class PostMessage
{
    public function __construct(
        private readonly ChatRichText $richText,
        private readonly SyncMessageMentions $mentions,
        private readonly AttachMessageFiles $attachments,
        private readonly ChannelMembership $membership,
    ) {}

    /**
     * @param  array<mixed>|null  $body  Tiptap document
     * @param  list<string>  $driveFileIds
     */
    public function handle(Channel $channel, User $author, ?array $body, array $driveFileIds = [], ?Message $parent = null): Message
    {
        if ($parent !== null && ($parent->channel_id !== $channel->id || $parent->parent_id !== null)) {
            throw ValidationException::withMessages(['parent_id' => 'Balasan harus untuk pesan utama di obrolan ini.']);
        }

        $prepared = $this->richText->prepare($channel, $author, $body);

        if ($prepared['document'] === null && $driveFileIds === []) {
            throw ValidationException::withMessages(['body' => 'Pesan tidak boleh kosong.']);
        }

        $message = DB::transaction(function () use ($channel, $author, $prepared, $driveFileIds, $parent): Message {
            if ($channel->type === ChannelType::Public) {
                $this->membership->add($channel, [$author->id => ChannelRole::Member]);
            }

            $message = $channel->messages()->create([
                'user_id' => $author->id,
                'parent_id' => $parent?->id,
                'body' => $prepared['document'],
                'body_text' => $prepared['text'],
            ]);

            $this->attachments->handle($channel, $message, $author, $driveFileIds);
            $mentioned = $this->mentions->handle($channel, $message, $author, $prepared['mentioned_ids']);

            ChannelMember::query()
                ->where('channel_id', $channel->id)
                ->where('user_id', $author->id)
                ->update(['last_read_message_id' => $message->id, 'updated_at' => now()]);

            $this->notifyDirect($channel, $message, $author, $mentioned);

            return $message;
        });

        MessagePosted::dispatch($channel, ['message_id' => $message->id, 'parent_id' => $parent?->id]);
        ChatActivity::dispatch($channel, $this->otherMemberIds($channel, $author));

        return $message;
    }

    /**
     * One unread "Pesan baru" per DM/group and person: while an earlier one is
     * still unread in the Inbox, the next messages only bump the badge.
     *
     * @param  list<string>  $alreadyNotified  mentioned people
     */
    private function notifyDirect(Channel $channel, Message $message, User $author, array $alreadyNotified): void
    {
        if (! $channel->type->isDirect()) {
            return;
        }

        $candidateIds = ChannelMember::query()
            ->where('channel_id', $channel->id)
            ->where('user_id', '!=', $author->id)
            ->where('muted', false)
            ->whereNotIn('user_id', $alreadyNotified)
            ->pluck('user_id')
            ->all();

        if ($candidateIds === []) {
            return;
        }

        $pending = InboxNotification::query()
            ->whereIn('notifiable_id', $candidateIds)
            ->where('type', NotificationType::ChatMessage->value)
            ->where('subject_type', $channel->getMorphClass())
            ->where('subject_id', $channel->id)
            ->whereNull('read_at')
            ->whereNull('archived_at')
            ->pluck('notifiable_id')
            ->all();

        $recipients = User::query()->whereIn('id', array_diff($candidateIds, $pending))->get();

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients->all(), new DirectMessageNotification($channel, $message, $author));
        }
    }

    /**
     * @return list<string>
     */
    private function otherMemberIds(Channel $channel, User $author): array
    {
        /** @var list<string> */
        return ChannelMember::query()
            ->where('channel_id', $channel->id)
            ->where('user_id', '!=', $author->id)
            ->pluck('user_id')
            ->all();
    }
}
