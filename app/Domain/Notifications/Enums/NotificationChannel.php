<?php

namespace App\Domain\Notifications\Enums;

/**
 * Delivery channels a user can configure per event (notification_preferences.channel).
 */
enum NotificationChannel: string
{
    case InApp = 'in_app';
    case Email = 'email';
    case WhatsApp = 'whatsapp';

    public function label(): string
    {
        return match ($this) {
            self::InApp => 'In-app',
            self::Email => 'Email',
            self::WhatsApp => 'WhatsApp',
        };
    }

    /**
     * Whether the channel can deliver at all in this installation.
     * WhatsApp is Phase 2 and stays off until a provider is configured.
     */
    public function isAvailable(): bool
    {
        return match ($this) {
            self::InApp, self::Email => true,
            self::WhatsApp => config()->boolean('notifications.channels.whatsapp.enabled'),
        };
    }
}
