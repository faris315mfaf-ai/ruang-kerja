<?php

namespace App\Domain\Tasks\Actions;

use App\Events\Tasks\CommentUpdated;
use App\Models\Comment;
use App\Models\Reaction;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Adds or removes the user's emoji reaction on a comment; returns true when
 * the reaction now exists. Unique per (comment, user, emoji).
 */
final class ToggleReaction
{
    public function handle(Comment $comment, User $user, string $emoji): bool
    {
        if (! in_array($emoji, Reaction::EMOJI, true)) {
            throw new InvalidArgumentException("Unsupported reaction [{$emoji}].");
        }

        $added = DB::transaction(function () use ($comment, $user, $emoji): bool {
            $deleted = $comment->reactions()->where('user_id', $user->id)->where('emoji', $emoji)->delete();

            if ($deleted > 0) {
                return false;
            }

            Reaction::query()->insertOrIgnore([
                'id' => strtolower((string) Str::ulid()),
                'reactable_type' => $comment->getMorphClass(),
                'reactable_id' => $comment->id,
                'user_id' => $user->id,
                'emoji' => $emoji,
                'created_at' => now(),
            ]);

            return true;
        });

        $task = $comment->commentable;

        if ($task instanceof Task) {
            CommentUpdated::dispatch($comment, $task);
        }

        return $added;
    }
}
