<?php

namespace App\Domain\Notes\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Note;
use App\Models\User;
use App\Policies\NotePolicy;

/**
 * "Hana Putri menyebut Anda di catatan SOP onboarding". Only sent to people
 * who can open the note, once per note and person (SyncNoteMentions). The
 * note text is not copied into the notification: email shows the title only.
 */
final class NoteMentionNotification extends BaseNotification
{
    public function __construct(
        public readonly Note $note,
        public readonly User $actor,
    ) {}

    public function type(): NotificationType
    {
        return NotificationType::Mention;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "{$this->actor->name} menyebut Anda di catatan {$this->note->title}",
            body: 'Buka catatan untuk melihat konteksnya.',
            url: '/catatan/'.$this->note->id,
            actor: NotificationActor::fromUser($this->actor),
            subject: NotificationSubject::fromModel($this->note, null, $this->note->title),
            meta: ['open_label' => 'Buka catatan'],
        );
    }

    /** Dropped when the note was deleted or the recipient lost access while queued. */
    protected function stillVisibleTo(User $notifiable): bool
    {
        $note = Note::query()->find($this->note->id);

        return $note !== null && app(NotePolicy::class)->canView($notifiable, $note);
    }
}
