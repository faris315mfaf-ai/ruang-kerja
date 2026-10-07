<?php

namespace App\Domain\Notes\Actions;

use App\Domain\Notes\Notifications\NoteMentionNotification;
use App\Domain\Notes\Services\NoteAudience;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Services\NotificationDispatchLog;
use App\Models\Note;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

/**
 * Rebuilds the `mentions` rows of a note and notifies people mentioned for
 * the first time (once per note and person, like SyncMentions for task
 * descriptions). Only people who can open the note are kept; the editor
 * never notifies themselves. Returns the notified ids.
 */
final class SyncNoteMentions
{
    public function __construct(
        private readonly NoteAudience $audience,
        private readonly NotificationDispatchLog $dispatchLog,
    ) {}

    /**
     * @param  list<string>  $mentionedIds
     * @return list<string>
     */
    public function handle(Note $note, User $actor, array $mentionedIds): array
    {
        $allowed = $this->audience->withAccess($note, $mentionedIds);
        $allowedIds = $allowed->pluck('id')->all();

        /** @var list<string> $existing */
        $existing = $note->mentions()->pluck('mentioned_user_id')->all();
        $note->mentions()->whereNotIn('mentioned_user_id', $allowedIds)->delete();

        $new = $allowed->filter(fn (User $user): bool => ! in_array($user->id, $existing, true));

        foreach ($new as $user) {
            $note->mentions()->create([
                'mentioned_user_id' => $user->id,
                'created_by' => $actor->id,
                'created_at' => now(),
            ]);
        }

        $recipients = $new
            ->filter(fn (User $user): bool => $user->id !== $actor->id
                && $this->dispatchLog->claim($user, NotificationType::Mention, $note, 'once'))
            ->values();

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients->all(), new NoteMentionNotification($note, $actor));
        }

        /** @var list<string> */
        return $recipients->pluck('id')->values()->all();
    }
}
