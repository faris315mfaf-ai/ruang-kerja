<?php

namespace App\Domain\Requests\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Models\EmployeeRequest;
use App\Models\User;

/**
 * Base of request notifications on the Sprint 8 infrastructure (preferences,
 * Inbox, broadcast, branded email, quiet hours, queued after commit).
 */
abstract class RequestNotification extends BaseNotification
{
    public function __construct(public readonly EmployeeRequest $request) {}

    abstract public function title(User $notifiable): string;

    abstract public function body(User $notifiable): ?string;

    abstract public function url(User $notifiable): string;

    /**
     * Who acted (requester or approver).
     */
    abstract protected function actor(): ?User;

    /**
     * @return array<string, mixed>
     */
    protected function meta(User $notifiable): array
    {
        return [];
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $actor = $this->actor();

        return new NotificationPayload(
            title: $this->title($notifiable),
            body: $this->body($notifiable),
            url: $this->url($notifiable),
            actor: $actor === null ? null : NotificationActor::fromUser($actor),
            subject: NotificationSubject::fromModel($this->request, $this->request->number, $this->request->leaveType->name),
            meta: $this->meta($notifiable),
        );
    }
}
