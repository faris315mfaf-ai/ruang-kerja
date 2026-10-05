<?php

namespace App\Domain\Notifications\Digest\Sections;

use App\Domain\Notifications\Digest\Contracts\DigestSection;
use App\Domain\Notifications\Digest\Data\DigestItem;
use App\Domain\Notifications\Digest\Data\DigestSectionData;
use App\Models\InboxNotification;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Built-in section: unresolved "Perlu tindakan" items in the Inbox. Works for
 * every module that sends action-required notifications; types covered by a
 * richer section (overdue tasks, pending approvals) are excluded so nothing
 * is listed twice (config notifications.digest.inbox_section_excludes).
 */
final class InboxActionSection implements DigestSection
{
    private const int LIMIT = 5;

    public function build(User $user, CarbonImmutable $date): ?DigestSectionData
    {
        // Types with a dedicated section (config notifications.digest.inbox_section_excludes)
        // are not repeated here, e.g. approvals → "Menunggu persetujuan Anda".
        $query = InboxNotification::query()
            ->visibleTo($user)
            ->needsAction()
            ->whereNotIn('type', array_values(array_filter(
                (array) config('notifications.digest.inbox_section_excludes', []),
                is_string(...),
            )));
        $count = (clone $query)->count();

        if ($count === 0) {
            return null;
        }

        $items = [];

        foreach ((clone $query)->orderBy('created_at')->limit(self::LIMIT)->get() as $notification) {
            $type = $notification->notificationType();
            // A module may give a neutral title for email (meta.external_title, e.g. sick leave):
            // then neither the in-app title nor the subject code leaves the app.
            $external = $notification->dataString('meta.external_title');

            $items[] = new DigestItem(
                title: $external ?? $notification->dataString('title') ?? 'Notifikasi',
                code: $external === null ? $notification->dataString('subject.code') : null,
                badge: $type?->label(),
                badgeTone: $type?->tone() === 'danger' ? 'danger' : 'info',
            );
        }

        $rest = $count - count($items);

        return new DigestSectionData(
            key: 'inbox.action',
            title: "Perlu tindakan di Inbox ({$count})",
            tileLabel: 'Perlu tindakan',
            count: $count,
            items: $items,
            more: $rest > 0 ? "dan {$rest} lainnya di Inbox" : null,
        );
    }
}
