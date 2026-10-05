<?php

namespace App\Domain\Notifications\Channels;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Contracts\WhatsAppProvider;
use Illuminate\Notifications\Notification;

/**
 * Phase 2 channel. Inactive in Phase 1: BaseNotification::via() only adds it
 * when config notifications.channels.whatsapp.enabled is true, and the bound
 * provider is NullWhatsAppProvider until a real one is chosen.
 */
final class WhatsAppChannel
{
    public function __construct(private readonly WhatsAppProvider $provider) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notification instanceof BaseNotification || ! method_exists($notifiable, 'routeNotificationFor')) {
            return;
        }

        $phone = $notifiable->routeNotificationFor('whatsapp', $notification);

        if (! is_string($phone) || $phone === '') {
            return;
        }

        $this->provider->send($phone, $notification->toWhatsApp($notifiable));
    }
}
