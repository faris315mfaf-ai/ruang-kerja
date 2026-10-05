<?php

namespace App\Http\Resources;

use App\Models\Attachment;
use App\Models\Comment;
use App\Models\Reaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Comment in the task timeline (resources/js/features/tasks/detail/types.ts
 * `TaskComment`). Viewer-independent so it can be broadcast; the client
 * derives "mine" from `user_ids`. Eager-load self::RELATIONS. A soft-deleted
 * comment keeps its place without body and without attachments.
 *
 * @mixin Comment
 */
class CommentResource extends JsonResource
{
    /**
     * Relations the resource reads (avoid N+1 in timelines and broadcasts).
     *
     * @var list<string>
     */
    public const array RELATIONS = [
        'author',
        'reactions.user',
        'attachments.driveFile.addedBy:id,name',
        'attachments.uploader:id,name',
    ];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Comment $comment */
        $comment = $this->resource;
        $deleted = $comment->trashed();

        return [
            'kind' => 'comment',
            'id' => $comment->id,
            'task_id' => $comment->commentable_id,
            'author' => PersonResource::from($comment->author),
            'body' => $deleted ? null : $comment->body,
            'body_text' => $deleted ? null : $comment->body_text,
            'created_at' => $comment->created_at?->toIso8601String(),
            'edited_at' => $deleted ? null : $comment->edited_at?->toIso8601String(),
            'deleted' => $deleted,
            'reactions' => $deleted ? [] : self::reactions($comment),
            'attachments' => $deleted || ! $comment->relationLoaded('attachments')
                ? []
                : $comment->attachments->map(fn (Attachment $attachment): array => (new AttachmentResource($attachment))->resolve())->values()->all(),
        ];
    }

    /**
     * @return list<array{emoji: string, count: int, user_ids: list<string>, names: list<string>}>
     */
    public static function reactions(Comment $comment): array
    {
        $groups = [];

        foreach ($comment->reactions->sortBy('created_at') as $reaction) {
            /** @var Reaction $reaction */
            $groups[$reaction->emoji] ??= ['emoji' => $reaction->emoji, 'count' => 0, 'user_ids' => [], 'names' => []];
            $groups[$reaction->emoji]['count']++;
            $groups[$reaction->emoji]['user_ids'][] = $reaction->user_id;
            $groups[$reaction->emoji]['names'][] = $reaction->user->name;
        }

        return array_values($groups);
    }
}
