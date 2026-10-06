<?php

namespace App\Domain\Hiring\Notifications;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Notifications\Data\NotificationActor;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\Candidate;
use App\Models\User;

/**
 * To HR: the final approvers decided — every approver agreed (Diterima) or
 * one of them rejected (Ditolak, with the reason in-app only).
 */
final class CandidateDecidedNotification extends HiringNotification
{
    public function __construct(Candidate $candidate, public readonly ?User $actor = null)
    {
        parent::__construct($candidate);
    }

    public function type(): NotificationType
    {
        return NotificationType::HiringCandidateDecided;
    }

    public function payload(User $notifiable): NotificationPayload
    {
        $hired = $this->candidate->stage === CandidateStage::Hired;

        return new NotificationPayload(
            title: $hired
                ? "{$this->candidate->full_name} diterima untuk {$this->positionTitle()}"
                : "{$this->candidate->full_name} ditolak untuk {$this->positionTitle()}",
            body: $hired ? 'Semua penyetuju akhir menyetujui.' : $this->candidate->rejected_reason,
            url: $this->url(),
            actor: $this->actor !== null ? NotificationActor::fromUser($this->actor) : null,
            subject: $this->subject(),
            meta: [
                'open_label' => 'Buka profil kandidat',
                'context' => $hired ? 'Diterima' : 'Ditolak',
                'context_tone' => $hired ? 'success' : 'danger',
                'quote' => ! $hired,
            ],
        );
    }

    protected function externalTitle(): string
    {
        return $this->candidate->stage === CandidateStage::Hired
            ? "Keputusan akhir: kandidat {$this->positionTitle()} diterima"
            : "Keputusan akhir: kandidat {$this->positionTitle()} ditolak";
    }
}
