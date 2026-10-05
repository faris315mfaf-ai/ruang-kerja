<?php

namespace App\Domain\Notifications\Digest\Sections;

use App\Domain\Notifications\Digest\Contracts\DigestSection;
use App\Domain\Notifications\Digest\Data\DigestItem;
use App\Domain\Notifications\Digest\Data\DigestSectionData;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Built-in section: unresolved "Perlu tindakan" items in the Inbox. Works for
 * every module that sends action-required notifications, until modules add
 * richer sections (tasks due today, overdue, pending approvals).
 */
final class InboxActionSection implements DigestSection
{
    private const int LIMIT = 5;

    public function build(User $user, CarbonImmutable $date): ?DigestSectionData
    {
        // Kinds with their own section: overdue tasks (TasksOverdueSection), pending approvals (PendingApprovalsSection).
        $query = InboxNotification::query()->visibleTo($user)->needsAction()
            ->whereNotIn('type', [NotificationType::TaskOverdue->value, NotificationType::RequestSubmitted->value]);
        $count = (clone $query)->count();

        if ($count === 0) {
            return null;
        }

        $items = [];

        foreach ((clone $query)->orderBy('created_at')->limit(self::LIMIT)->get() as $notification) {
            $type = $notification->notificationType();

            $items[] = new DigestItem(
                title: $notification->dataString('title') ?? 'Notifikasi',
                code: $notification->dataString('subject.code'),
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
