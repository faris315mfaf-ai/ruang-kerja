<?php

namespace App\Http\Resources\Api;

use App\Domain\Notifications\Enums\AndroidChannel;
use App\Domain\Notifications\Services\NotificationTarget;
use App\Http\Resources\InboxNotificationResource;
use App\Models\InboxNotification;
use Illuminate\Http\Request;

/**
 * Inbox item of the mobile app: the web InboxNotificationResource fields plus
 * `target` ({type, id, anchor, params} or null, so the app never parses the
 * web `url`) and `android_channel` (rk_* channel id of the notification type).
 *
 * @property InboxNotification $resource
 */
class InboxItemResource extends InboxNotificationResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $notification = $this->resource;
        $type = $notification->notificationType();
        $target = app(NotificationTarget::class)->resolve($type, $notification->data);

        return [
            ...parent::toArray($request),
            'target' => $target === null ? null : [...$target, 'params' => (object) $target['params']],
            'android_channel' => ($type === null ? AndroidChannel::Info : AndroidChannel::forType($type))->value,
        ];
    }
}
