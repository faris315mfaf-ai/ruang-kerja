<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Domain\Requests\Enums\RequestCategory;
use App\Models\EmployeeRequest;
use App\Models\User;

/**
 * Base of request notifications on the Sprint 8 infrastructure (preferences,
 * Inbox, broadcast, branded email, quiet hours, queued after commit).
 *
 * Privacy (Fitur pengajuan #4): email/WhatsApp (externalPayload) never carry
 * free text — decision notes are replaced by "open the app" (noteInApp()) —
 * and requests of a sensitive category (Sakit) use a neutral title without
 * type name or number ("Pengajuan Anda …", neutralTitle()).
 */
abstract class RequestNotification extends BaseNotification
{
    /** Shown instead of a decision note outside the app. */
    public const string NOTE_IN_APP = 'Keputusan sudah dibuat. Buka RuangKerja untuk melihat detail dan catatannya.';

    public function __construct(public readonly EmployeeRequest $request) {}

    abstract public function title(User $notifiable): string;

    abstract public function body(User $notifiable): ?string;

    abstract public function url(User $notifiable): string;

    /**
     * Who acted (requester or approver).
     */
    abstract protected function actor(): ?User;

    /**
     * Title without type name or number, for sensitive requests outside the app.
     */
    abstract public function neutralTitle(User $notifiable): string;

    /**
     * @return array<string, mixed>
     */
    protected function meta(User $notifiable): array
    {
        return [];
    }

    /**
     * The body carries a free-text decision note (shown in-app only).
     */
    protected function noteInApp(): bool
    {
        return false;
    }

    /**
     * Health-related requests: no type name, number or details outside the app.
     */
    public function isSensitive(): bool
    {
        return $this->request->leaveType->category === RequestCategory::Sick;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $actor = $this->actor();
        $meta = $this->meta($notifiable);

        if ($this->isSensitive()) {
            // Digest emails list Inbox items by title: give them the neutral one.
            $meta['external_title'] = $this->neutralTitle($notifiable);
        }

        return new NotificationPayload(
            title: $this->title($notifiable),
            body: $this->body($notifiable),
            url: $this->url($notifiable),
            actor: $actor === null ? null : NotificationActor::fromUser($actor),
            subject: NotificationSubject::fromModel($this->request, $this->request->number, $this->request->leaveType->name),
            meta: $meta,
        );
    }

    public function externalPayload(User $notifiable): NotificationPayload
    {
        $payload = $this->payload($notifiable);
        $sensitive = $this->isSensitive();
        $meta = $payload->meta;
        unset($meta['external_title']);

        if ($this->noteInApp()) {
            unset($meta['quote']);
        }

        return new NotificationPayload(
            title: $sensitive ? $this->neutralTitle($notifiable) : $payload->title,
            body: $this->noteInApp() ? self::NOTE_IN_APP : $payload->body,
            url: $payload->url,
            actor: $payload->actor,
            subject: $sensitive
                ? NotificationSubject::fromModel($this->request, null, 'Pengajuan')
                : $payload->subject,
            meta: $meta,
        );
    }
}
