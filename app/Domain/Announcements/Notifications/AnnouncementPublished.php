<?php

namespace App\Domain\Announcements\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * New announcement (`system.announcement`, in-app always on). Dropped when the
 * announcement was deleted or the recipient lost it before delivery.
 */
final class AnnouncementPublished extends BaseNotification
{
    public function __construct(public readonly Announcement $announcement) {}

    public function type(): NotificationType
    {
        return NotificationType::SystemAnnouncement;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $author = $this->announcement->author;

        return new NotificationPayload(
            title: 'Pengumuman: '.$this->announcement->title,
            body: Str::limit(preg_replace('/\s+/', ' ', $this->announcement->body) ?? '', 160),
            url: '/pengumuman?pilih='.$this->announcement->id,
            actor: $author === null ? null : NotificationActor::fromUser($author),
            subject: NotificationSubject::fromModel($this->announcement, null, $this->announcement->title),
            meta: ['open_label' => 'Baca pengumuman'],
        );
    }

    protected function stillVisibleTo(User $notifiable): bool
    {
        $current = Announcement::query()->find($this->announcement->id);

        return $current !== null && $current->isActive();
    }
}
