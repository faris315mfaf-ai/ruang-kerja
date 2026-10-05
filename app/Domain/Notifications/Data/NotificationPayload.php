<?php

namespace App\Domain\Notifications\Data;

use App\Domain\Notifications\Enums\NotificationType;
use InvalidArgumentException;

/**
 * Uniform notification content used by every channel.
 *
 * Shape (database `data`, broadcast and API):
 * {type, title, body, url, actor{id,name,avatar}|null, subject{type,id,code,title}|null, meta{}}
 *
 * Documented `meta` keys understood by the Inbox UI:
 * - `context` (string): short extra line, e.g. "lewat 1 hari kerja".
 * - `context_tone` (danger|warning|info|success): color of `context`.
 * - `open_label` (string): label of the primary button, e.g. "Buka tugas".
 * - `quote` (bool): render `body` as a quote (comments, mentions).
 * - `plan_url` + `plan_label` (string): secondary button, an app-relative link
 *   (task assigned → "Rencanakan di Ruang saya", /dashboard/saya#ruang-saya).
 * - `external_title` (string): neutral title used instead of `title` (and without
 *   the subject code) when the item is listed in an email, e.g. sick leave.
 * Modules may add other scalar keys; they are kept but not rendered.
 */
final readonly class NotificationPayload
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        public string $title,
        public ?string $body = null,
        public ?string $url = null,
        public ?NotificationActor $actor = null,
        public ?NotificationSubject $subject = null,
        public array $meta = [],
    ) {
        if ($url !== null && ! self::isInternalUrl($url)) {
            throw new InvalidArgumentException('Notification URLs must be app-relative paths (start with a single "/").');
        }
    }

    /**
     * Only app-relative paths are allowed so `/inbox/{id}/buka` can never be
     * used as an open redirect.
     */
    public static function isInternalUrl(string $url): bool
    {
        return str_starts_with($url, '/') && ! str_starts_with($url, '//') && ! str_contains($url, '\\');
    }

    /**
     * @return array{type: string, title: string, body: string|null, url: string|null, actor: array{id: string, name: string, avatar: string|null}|null, subject: array{type: string, id: string, code: string|null, title: string|null}|null, meta: array<string, mixed>}
     */
    public function toArray(NotificationType $type): array
    {
        return [
            'type' => $type->value,
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'actor' => $this->actor?->toArray(),
            'subject' => $this->subject?->toArray(),
            'meta' => $this->meta,
        ];
    }
}
