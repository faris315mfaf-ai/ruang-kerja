<?php

namespace App\Domain\Hiring\Notifications;

use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Notifications\Support\IndonesianDate;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\Candidate;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * To each interviewer of the position: HR set or changed the interview date
 * of a candidate (Ruang HR, keputusan pemilik 20 Okt 2026). Preference
 * `hiring.activity`; email names the position only (HiringNotification).
 */
final class InterviewScheduledNotification extends HiringNotification
{
    public function __construct(Candidate $candidate, public readonly ?User $actor = null)
    {
        parent::__construct($candidate);
    }

    public function type(): NotificationType
    {
        return NotificationType::HiringInterviewScheduled;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        return new NotificationPayload(
            title: "Wawancara {$this->candidate->full_name}: {$this->when()}",
            body: $this->body(),
            url: $this->url().'?tab=wawancara',
            actor: $this->actor !== null ? NotificationActor::fromUser($this->actor) : null,
            subject: $this->subject(),
            meta: ['open_label' => 'Lihat kandidat'],
        );
    }

    protected function externalTitle(): string
    {
        return "Jadwal wawancara kandidat {$this->positionTitle()}: {$this->when()}";
    }

    private function body(): string
    {
        $location = $this->candidate->interview_location;

        return $location !== null && $location !== ''
            ? "{$this->positionTitle()} · {$location}"
            : $this->positionTitle();
    }

    /** "Sel, 21 Okt 2026 10.00" in office time. */
    private function when(): string
    {
        $at = $this->candidate->interview_at;

        if (! $at instanceof CarbonImmutable) {
            return 'belum dijadwalkan';
        }

        $local = $at->setTimezone(CurrentCompany::timezone());

        return IndonesianDate::short($local).' '.$local->format('H.i');
    }
}
