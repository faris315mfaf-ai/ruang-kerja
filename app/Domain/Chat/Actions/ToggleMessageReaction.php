<?php

namespace App\Domain\Chat\Actions;

use App\Events\Chat\MessageUpdated;
use App\Models\Message;
use App\Models\Reaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Adds or removes the user's emoji on a message (fixed list Reaction::EMOJI);
 * returns true when the reaction now exists.
 */
final class ToggleMessageReaction
{
    public function handle(Message $message, User $user, string $emoji): bool
    {
        if (! in_array($emoji, Reaction::EMOJI, true)) {
            throw new InvalidArgumentException("Unsupported reaction [{$emoji}].");
        }

        $added = DB::transaction(function () use ($message, $user, $emoji): bool {
            $deleted = $message->reactions()->where('user_id', $user->id)->where('emoji', $emoji)->delete();

            if ($deleted > 0) {
                return false;
            }

            Reaction::query()->insertOrIgnore([
                'id' => strtolower((string) Str::ulid()),
                'reactable_type' => $message->getMorphClass(),
                'reactable_id' => $message->id,
                'user_id' => $user->id,
                'emoji' => $emoji,
                'created_at' => now(),
            ]);

            return true;
        });

        MessageUpdated::dispatch($message->channel, ['message_id' => $message->id, 'parent_id' => $message->parent_id]);

        return $added;
    }
}
