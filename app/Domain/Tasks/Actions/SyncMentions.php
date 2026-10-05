<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Notifications\MentionNotification;
use App\Domain\Tasks\Services\TaskAudience;
use App\Models\Comment;
use App\Models\Mention;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

/**
 * Rebuilds the `mentions` rows of a comment or task description from the
 * mentioned ids (MentionParser) and notifies people mentioned for the first
 * time. Only people who can see the workspace are kept: mentioning someone
 * outside a private workspace creates no row and no notification, so no
 * content leaks. The author never notifies themselves.
 *
 * Returns the ids that received a mention notification.
 */
final class SyncMentions
{
    public function __construct(private readonly TaskAudience $audience) {}

    /**
     * @param  list<string>  $mentionedIds
     * @return list<string>
     */
    public function handle(Task $task, Comment|Task $mentionable, User $actor, array $mentionedIds): array
    {
        $task->loadMissing('workspace');
        $allowed = $this->audience->withAccess($task->workspace, $mentionedIds);
        $allowedIds = $allowed->pluck('id')->all();

        /** @var list<string> $existing */
        $existing = $mentionable->mentions()->pluck('mentioned_user_id')->all();

        $mentionable->mentions()->whereNotIn('mentioned_user_id', $allowedIds)->delete();

        $new = $allowed->filter(fn (User $user): bool => ! in_array($user->id, $existing, true));

        foreach ($new as $user) {
            $mentionable->mentions()->create([
                'mentioned_user_id' => $user->id,
                'created_by' => $actor->id,
                'created_at' => now(),
            ]);
        }

        $recipients = $new->filter(fn (User $user): bool => $user->id !== $actor->id)->values();

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients->all(), new MentionNotification(
                $task,
                $actor,
                $mentionable instanceof Comment ? $mentionable : null,
            ));
        }

        /** @var list<string> */
        return $recipients->pluck('id')->values()->all();
    }
}
