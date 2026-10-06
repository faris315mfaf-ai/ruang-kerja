<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Services\ChatRichText;
use App\Events\Chat\MessageUpdated;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Edits the text of the author's own message ("(disunting)"). New mentions
 * notify once; removed mentions lose their row.
 */
final class EditMessage
{
    public function __construct(
        private readonly ChatRichText $richText,
        private readonly SyncMessageMentions $mentions,
    ) {}

    /**
     * @param  array<mixed>|null  $body
     */
    public function handle(Message $message, User $actor, ?array $body): Message
    {
        $channel = $message->channel;
        $prepared = $this->richText->prepare($channel, $actor, $body);

        if ($prepared['document'] === null && ! $message->attachments()->exists()) {
            throw ValidationException::withMessages(['body' => 'Pesan tidak boleh kosong. Hapus pesan bila tidak diperlukan lagi.']);
        }

        DB::transaction(function () use ($message, $actor, $channel, $prepared): void {
            $message->forceFill([
                'body' => $prepared['document'],
                'body_text' => $prepared['text'],
                'edited_at' => now(),
            ])->save();

            $this->mentions->handle($channel, $message, $actor, $prepared['mentioned_ids']);
        });

        MessageUpdated::dispatch($channel, ['message_id' => $message->id, 'parent_id' => $message->parent_id]);

        return $message;
    }
}
