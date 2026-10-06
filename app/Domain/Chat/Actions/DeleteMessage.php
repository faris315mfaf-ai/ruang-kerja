<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Events\Chat\MessageDeleted;
use App\Models\InboxNotification;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deletes a message: it stays in the timeline as "Pesan ini dihapus"
 * with its thread replies, but its text, mentions, reactions, attachments and
 * Inbox notifications are removed so the content does not outlive it. A
 * moderator deleting someone else's message is audited.
 */
final class DeleteMessage
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(Message $message, User $actor): void
    {
        DB::transaction(function () use ($message, $actor): void {
            if ($message->user_id !== $actor->id) {
                $this->audit->log('message.deleted', $message, ['user_id' => $message->user_id, 'channel_id' => $message->channel_id], null, $actor);
            }

            $message->mentions()->delete();
            $message->reactions()->delete();
            $message->attachments()->delete();
            InboxNotification::query()->where('data->meta->message_id', $message->id)->delete();

            $message->forceFill(['body' => null, 'body_text' => ''])->save();
            $message->delete();
        });

        MessageDeleted::dispatch($message->channel, ['message_id' => $message->id, 'parent_id' => $message->parent_id]);
    }
}
