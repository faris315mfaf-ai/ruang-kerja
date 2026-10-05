<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Enums\NotificationChannel;
use App\Domain\Notifications\Enums\NotificationEvent;
use App\Models\NotificationPreference;
use App\Models\User;

/**
 * Resolves the effective on/off state of (event, channel) for a user:
 * locked channels are always on, unavailable/unsupported ones always off,
 * otherwise the user's row in notification_preferences, else the config default.
 */
final class NotificationPreferenceResolver
{
    public function isEnabled(User $user, NotificationEvent $event, NotificationChannel $channel): bool
    {
        return $this->resolve($event, $channel, $this->overrides($user));
    }

    /**
     * isEnabled() for many users with one query (e.g. the digest dispatcher).
     *
     * @param  list<string>  $userIds
     * @return array<string, bool> user id => enabled
     */
    public function enabledFor(array $userIds, NotificationEvent $event, NotificationChannel $channel): array
    {
        $overrides = NotificationPreference::query()
            ->whereIn('user_id', $userIds)
            ->where('event', $event->value)
            ->where('channel', $channel->value)
            ->pluck('enabled', 'user_id');
        $key = $event->value.'|'.$channel->value;
        $enabled = [];

        foreach ($userIds as $userId) {
            $override = $overrides->get($userId);
            $enabled[$userId] = $this->resolve($event, $channel, is_bool($override) ? [$key => $override] : []);
        }

        return $enabled;
    }

    /**
     * @return list<NotificationChannel>
     */
    public function enabledChannels(User $user, NotificationEvent $event): array
    {
        $overrides = $this->overrides($user);

        return array_values(array_filter(
            $event->channels(),
            fn (NotificationChannel $channel): bool => $this->resolve($event, $channel, $overrides),
        ));
    }

    /**
     * Full matrix for the settings page.
     *
     * @return list<array{event: string, label: string, category: string, channels: array<string, array{enabled: bool, configurable: bool, supported: bool}>}>
     */
    public function matrix(User $user): array
    {
        $overrides = $this->overrides($user);
        $rows = [];

        foreach (NotificationEvent::matrix() as $event) {
            $channels = [];

            foreach (NotificationChannel::cases() as $channel) {
                $channels[$channel->value] = [
                    'enabled' => $this->resolve($event, $channel, $overrides),
                    'configurable' => $event->isConfigurable($channel),
                    'supported' => $event->supports($channel),
                ];
            }

            $rows[] = [
                'event' => $event->value,
                'label' => $event->label(),
                'category' => $event->category()->value,
                'channels' => $channels,
            ];
        }

        return $rows;
    }

    /**
     * @param  array<string, bool>  $overrides  keyed "event|channel"
     */
    private function resolve(NotificationEvent $event, NotificationChannel $channel, array $overrides): bool
    {
        if (! $event->supports($channel) || ! $channel->isAvailable()) {
            return false;
        }

        if ($event->isLocked($channel)) {
            return true;
        }

        return $overrides[$event->value.'|'.$channel->value] ?? $event->defaultEnabled($channel);
    }

    /**
     * @return array<string, bool>
     */
    private function overrides(User $user): array
    {
        $overrides = [];

        NotificationPreference::query()
            ->where('user_id', $user->id)
            ->get()
            ->each(function (NotificationPreference $preference) use (&$overrides): void {
                $overrides[$preference->event->value.'|'.$preference->channel->value] = $preference->enabled;
            });

        return $overrides;
    }
}
