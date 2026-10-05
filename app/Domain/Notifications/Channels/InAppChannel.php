<?php

namespace App\Domain\Notifications\Channels;

use App\Domain\Notifications\BaseNotification;
use Illuminate\Notifications\Channels\DatabaseChannel;
use Illuminate\Notifications\Notification;

/**
 * Database channel that also fills the Inbox columns of `notifications`
 * (subject morph and "Perlu tindakan" flag).
 */
final class InAppChannel extends DatabaseChannel
{
    /**
     * @param  mixed  $notifiable
     * @return array<string, mixed>
     */
    protected function buildPayload($notifiable, Notification $notification): array
    {
        /** @var array<string, mixed> $payload */
        $payload = parent::buildPayload($notifiable, $notification);

        $subject = $payload['data']['subject'] ?? null;

        return [
            ...$payload,
            'subject_type' => is_array($subject) && is_string($subject['type'] ?? null) ? $subject['type'] : null,
            'subject_id' => is_array($subject) && is_string($subject['id'] ?? null) && $subject['id'] !== '' ? $subject['id'] : null,
            'action_required' => $notification instanceof BaseNotification && $notification->requiresAction(),
        ];
    }
}
