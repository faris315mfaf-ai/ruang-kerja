<?php

namespace App\Domain\Notifications\Channels;

use App\Domain\Devices\Models\Device;
use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Enums\AndroidChannel;
use App\Domain\Notifications\Services\FcmClient;
use App\Domain\Notifications\Services\NotificationTarget;
use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Push to the Android app through FCM (HTTP v1). Follows the user's In-app
 * preference (BaseNotification::via adds it next to the in-app channel) and is
 * a deliberate no-op, logged, while FCM_PROJECT_ID / FCM_SERVICE_ACCOUNT_JSON
 * are not configured or the user has no device with a push token. It never
 * throws: a push problem must not fail or retry a notification.
 *
 * Text comes from externalPayload() (neutral titles for sick requests and
 * applicants), the target from payload() so a tap opens the same place as the
 * Inbox row. Payload contract: docs/sesi/ponsel-b2c-inbox.md.
 */
final class FcmChannel
{
    public function __construct(
        private readonly FcmClient $fcm,
        private readonly NotificationTarget $targets,
    ) {}

    public function send(mixed $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User || ! $notification instanceof BaseNotification) {
            return;
        }

        try {
            $devices = Device::query()
                ->where('user_id', $notifiable->id)
                ->whereNotNull('push_token')
                ->get(['id', 'push_token']);

            if ($devices->isEmpty()) {
                return;
            }

            if (! $this->fcm->isConfigured()) {
                Log::info('FCM belum dikonfigurasi; push dilewati.', [
                    'type' => $notification->type()->value,
                    'user_id' => $notifiable->id,
                    'devices' => $devices->count(),
                ]);

                return;
            }

            $message = $this->message($notifiable, $notification);

            foreach ($devices as $device) {
                $token = $device->push_token;

                if ($token === null) {
                    continue;
                }

                if ($this->fcm->send($token, $message) === FcmClient::RESULT_UNREGISTERED) {
                    // The installation is gone: forget the dead token (query builder, no model events).
                    Device::query()->whereKey($device->getKey())->where('push_token', $token)->update(['push_token' => null]);
                }
            }
        } catch (Throwable $e) {
            Log::warning('FCM: push dilewati karena galat.', ['exception' => $e::class, 'message' => $e->getMessage()]);
        }
    }

    /**
     * FCM v1 message without the device token. `data` values are strings.
     *
     * @return array<string, mixed>
     */
    public function message(User $user, BaseNotification $notification): array
    {
        $type = $notification->type();
        $channel = AndroidChannel::forType($type);
        $external = $notification->externalPayload($user);
        $target = $this->targets->resolve($type, $notification->payload($user)->toArray($type));
        $notificationId = (string) $notification->id;

        // No dedicated screen: the app opens the notification detail from the Inbox.
        $data = [
            'type' => $type->value,
            'target' => $target['type'] ?? 'inbox',
            'id' => $target === null ? $notificationId : (string) ($target['id'] ?? ''),
            'anchor' => (string) ($target['anchor'] ?? ''),
            'params' => json_encode((object) ($target['params'] ?? []), JSON_UNESCAPED_UNICODE) ?: '{}',
            'android_channel' => $channel->value,
            'notification_id' => $notificationId,
        ];

        return [
            'notification' => [
                'title' => Str::limit($external->title, 120, '…'),
                'body' => Str::limit(trim((string) $external->body), 180, '…'),
            ],
            'data' => $data,
            'android' => [
                'priority' => $channel->importance() === 'high' ? 'HIGH' : 'NORMAL',
                'notification' => array_filter([
                    'channel_id' => $channel->value,
                    'tag' => $notificationId !== '' ? $notificationId : null,
                ]),
            ],
        ];
    }
}
