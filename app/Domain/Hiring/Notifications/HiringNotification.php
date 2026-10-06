<?php

namespace App\Domain\Hiring\Notifications;

use App\Domain\Notifications\BaseNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Data\NotificationSubject;
use App\Models\Candidate;
use App\Models\User;
use App\Policies\CandidatePolicy;

/**
 * Shared parts of the Hiring notifications: subject = the candidate, link =
 * the candidate profile. Applicant names stay in the app: email/WhatsApp
 * (externalPayload) only name the position.
 */
abstract class HiringNotification extends BaseNotification
{
    public function __construct(public readonly Candidate $candidate) {}

    protected function stillVisibleTo(User $notifiable): bool
    {
        $candidate = Candidate::query()->find($this->candidate->id);

        return $candidate !== null && app(CandidatePolicy::class)->canView($notifiable, $candidate);
    }

    public function externalPayload(User $notifiable): NotificationPayload
    {
        $payload = $this->payload($notifiable);

        return new NotificationPayload(
            title: $this->externalTitle(),
            body: null,
            url: $payload->url,
            actor: $payload->actor,
            subject: NotificationSubject::fromModel($this->candidate, null, $this->positionTitle()),
            meta: ['open_label' => 'Buka di RuangKerja'],
        );
    }

    abstract protected function externalTitle(): string;

    protected function url(): string
    {
        return '/hiring/kandidat/'.$this->candidate->id;
    }

    protected function subject(): NotificationSubject
    {
        return NotificationSubject::fromModel($this->candidate, null, $this->candidate->full_name);
    }

    protected function positionTitle(): string
    {
        return $this->candidate->loadMissing('hiringPosition')->hiringPosition->title;
    }
}
