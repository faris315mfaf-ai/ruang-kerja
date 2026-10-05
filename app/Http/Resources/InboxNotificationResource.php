<?php

namespace App\Http\Resources;

use App\Models\InboxNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Uniform Inbox item (resources/js/types/notifications.ts → InboxNotification).
 *
 * @mixin InboxNotification
 *
 * @property InboxNotification $resource
 */
class InboxNotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $notification = $this->resource;
        $type = $notification->notificationType();
        $data = $notification->data;
        $meta = $data['meta'] ?? null;

        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'category' => $type?->category()->value ?? 'system',
            'icon' => $type?->icon() ?? 'bell',
            'tone' => $type?->tone() ?? 'neutral',
            'type_label' => $type?->label() ?? 'Notifikasi',
            'title' => $notification->dataString('title') ?? $type?->label() ?? 'Notifikasi',
            'body' => $notification->dataString('body'),
            'url' => $notification->dataString('url'),
            'actor' => is_array($data['actor'] ?? null) ? $data['actor'] : null,
            'subject' => is_array($data['subject'] ?? null) ? $data['subject'] : null,
            'meta' => is_array($meta) && $meta !== [] ? $meta : (object) [],
            'action_required' => $notification->isActionPending(),
            'read_at' => $notification->read_at?->toIso8601String(),
            'archived_at' => $notification->archived_at?->toIso8601String(),
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }
}
