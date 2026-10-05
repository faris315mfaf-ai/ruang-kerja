<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Turns one (event, channel) cell on or off for a user.
 */
final class UpdateNotificationPreference
{
    /**
     * @throws ValidationException when the cell is locked, unsupported or unavailable
     */
    public function handle(User $user, NotificationEvent $event, NotificationChannel $channel, bool $enabled): NotificationPreference
    {
        if (! $event->isConfigurable($channel)) {
            throw ValidationException::withMessages([
                'channel' => "Kanal {$channel->label()} untuk \"{$event->label()}\" tidak dapat diubah.",
            ]);
        }

        return NotificationPreference::query()->updateOrCreate(
            ['user_id' => $user->id, 'event' => $event->value, 'channel' => $channel->value],
            ['enabled' => $enabled],
        );
    }
}
