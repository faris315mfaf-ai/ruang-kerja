<?php

namespace App\Http\Resources\Chat;

use App\Models\Attachment;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\Message;
use App\Models\Reaction;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Props of the Obrolan pages, in the shapes of resources/js/features/chat/types.ts.
 * Deleted messages never carry their text, reactions or attachments.
 */
final class ChatPresenter
{
    /**
     * @return array{id: string, name: string, avatar: string|null, title: string, online: bool}
     */
    public static function person(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar' => $user->avatar_url,
            'title' => $user->position->name ?? '',
            'online' => false, // presence channel chat-online.{company} on the client
        ];
    }

    /**
     * @param  iterable<ChannelMember>  $members
     * @param  array{unread_count?: int, last_message?: array<string, mixed>|null, can_post: bool, can_manage: bool}  $state
     * @return array<string, mixed>
     */
    public static function channel(Channel $channel, iterable $members, array $state): array
    {
        $workspace = $channel->workspace;

        return [
            'id' => $channel->id,
            'workspace_id' => $channel->workspace_id,
            'workspace' => $workspace === null ? null : [
                'key' => $workspace->key,
                'name' => $workspace->name,
                'color' => $workspace->color ?? 'teal',
            ],
            'type' => $channel->type->value,
            'name' => $channel->name,
            'topic' => $channel->topic,
            'created_by' => $channel->created_by ?? '',
            'created_at' => self::iso($channel->created_at),
            'archived_at' => self::iso($channel->archived_at ?? $workspace?->archived_at),
            'members' => collect($members)->map(fn (ChannelMember $member): array => [
                'user_id' => $member->user_id,
                'last_read_message_id' => $member->last_read_message_id,
                'muted' => $member->muted,
                'role' => $member->role->value,
            ])->values()->all(),
            'unread_count' => $state['unread_count'] ?? 0,
            'last_message' => $state['last_message'] ?? null,
            'can_post' => $state['can_post'],
            'can_manage' => $state['can_manage'],
        ];
    }

    /**
     * Sidebar preview of the newest top-level message.
     *
     * @return array{id: string, user_id: string|null, body_text: string, created_at: string|null, deleted: bool}
     */
    public static function preview(Message $message): array
    {
        return [
            'id' => $message->id,
            'user_id' => $message->user_id,
            'body_text' => $message->trashed() ? '' : mb_substr($message->body_text, 0, 160),
            'created_at' => self::iso($message->created_at),
            'deleted' => $message->trashed(),
        ];
    }

    /**
     * Expects `reactions` and `attachments.driveFile` loaded.
     *
     * @return array<string, mixed>
     */
    public static function message(Message $message): array
    {
        $deleted = $message->trashed();

        return [
            'id' => $message->id,
            'channel_id' => $message->channel_id,
            'user_id' => $message->user_id ?? '',
            'parent_id' => $message->parent_id,
            'body' => $deleted ? null : $message->body,
            'body_text' => $deleted ? '' : $message->body_text,
            'created_at' => self::iso($message->created_at),
            'edited_at' => self::iso($message->edited_at),
            'deleted_at' => self::iso($message->deleted_at),
            'reactions' => $deleted ? [] : self::reactions($message),
            'attachments' => $deleted ? [] : $message->attachments
                ->filter(fn (Attachment $attachment): bool => $attachment->driveFile !== null)
                ->map(fn (Attachment $attachment): array => [
                    'id' => (string) $attachment->drive_file_id,
                    'name' => $attachment->filename,
                    'kind' => $attachment->driveFile->kind->value ?? 'other',
                    'web_view_link' => $attachment->driveFile->web_view_link ?? '',
                    'size_bytes' => $attachment->size_bytes,
                    'owner_email' => $attachment->driveFile->owner_email ?? null,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @return list<array{emoji: string, user_ids: list<string>}>
     */
    private static function reactions(Message $message): array
    {
        $grouped = [];

        foreach ($message->reactions->sortBy('created_at') as $reaction) {
            /** @var Reaction $reaction */
            $grouped[$reaction->emoji][] = $reaction->user_id;
        }

        $order = array_flip(Reaction::EMOJI);
        uksort($grouped, fn (string $a, string $b): int => ($order[$a] ?? 99) <=> ($order[$b] ?? 99));

        return array_map(
            fn (string $emoji, array $userIds): array => ['emoji' => $emoji, 'user_ids' => $userIds],
            array_keys($grouped),
            array_values($grouped),
        );
    }

    private static function iso(?CarbonInterface $time): ?string
    {
        return $time?->toIso8601String();
    }
}
