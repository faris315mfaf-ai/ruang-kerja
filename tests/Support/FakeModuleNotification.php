<?php

namespace Tests\Support;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\User;

/**
 * A notification of any type, written the way modules will write theirs.
 */
final class FakeModuleNotification extends BaseNotification
{
    public function __construct(
        public readonly NotificationType $kind,
        public readonly ?User $actor = null,
        public readonly ?User $subject = null,
    ) {}

    public function type(): NotificationType
    {
        return $this->kind;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: 'Judul '.$this->kind->label(),
            body: 'Isi notifikasi',
            url: '/tugas',
            actor: $this->actor ? NotificationActor::fromUser($this->actor) : null,
            subject: $this->subject ? NotificationSubject::fromModel($this->subject, 'PLQ-15', 'Siaran pers') : null,
            meta: ['context' => 'lewat 1 hari kerja', 'context_tone' => 'danger'],
        );
    }
}
