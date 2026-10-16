<?php

namespace App\Domain\Briefings\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Briefing;
use App\Models\User;

/**
 * Briefing minutes saved (`briefing.posted`, category Informatif, no action
 * needed): the subject line is "Briefing pagi 9 Oktober 2026" and the body
 * carries the full content — the Inbox entry is the briefing.
 */
final class BriefingPosted extends BaseNotification
{
    public function __construct(public readonly Briefing $briefing) {}

    public function type(): NotificationType
    {
        return NotificationType::BriefingPosted;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: $this->briefing->title(),
            body: $this->briefing->content,
            url: '/inbox',
            actor: NotificationActor::fromUser($this->briefing->creator),
            subject: NotificationSubject::fromModel($this->briefing, null, $this->briefing->title()),
            meta: ['open_label' => 'Baca briefing'],
        );
    }

    protected function stillVisibleTo(User $notifiable): bool
    {
        return Briefing::query()->whereKey($this->briefing->id)->exists();
    }
}
