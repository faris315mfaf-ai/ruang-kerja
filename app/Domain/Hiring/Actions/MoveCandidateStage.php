<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Notifications\DecisionNeededNotification;
use App\Domain\Hiring\Services\CandidateChecklist;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Candidate;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * HR moves a candidate to another stage (papan per tahap / chip di ponsel).
 *
 * - "Keputusan akhir" needs every required HR & interviewer checklist item
 *   ticked and at least one final approver; the approvers get an
 *   action-required notification.
 * - "Ditolak" needs a reason. "Diterima" is never set by hand: it follows
 *   from the approvers (DecideCandidate).
 * - Leaving "Keputusan akhir" (or reopening a decided candidate) clears the
 *   approvers' decisions and resolves their notifications.
 */
final class MoveCandidateStage
{
    public function __construct(
        private readonly CandidateChecklist $checklist,
        private readonly ResolveNotificationsForSubject $resolve,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $actor, Candidate $candidate, CandidateStage $target, ?string $reason = null): Candidate
    {
        $from = $candidate->stage;
        $reason = CreateHiringPosition::text($reason);

        if ($target === $from) {
            return $candidate;
        }

        if (! $target->isManualTarget()) {
            throw ValidationException::withMessages(['stage' => 'Kandidat diterima lewat keputusan semua penyetuju akhir, bukan dipindah manual.']);
        }

        if ($target === CandidateStage::Rejected && $reason === null) {
            throw ValidationException::withMessages(['reason' => 'Tulis alasan penolakan.']);
        }

        $position = $candidate->hiringPosition;
        $approvers = collect();

        if ($target === CandidateStage::FinalReview) {
            $open = $this->checklist->openRequiredBeforeFinal($candidate);

            if ($open > 0) {
                throw ValidationException::withMessages(['stage' => "Masih ada {$open} butir checklist wajib (HR & pewawancara) yang belum dicentang."]);
            }

            $approvers = User::query()
                ->whereIn('id', $position->final_approver_ids)
                ->where('status', UserStatus::Active)
                ->get();

            if ($approvers->isEmpty()) {
                throw ValidationException::withMessages(['stage' => 'Lowongan ini belum punya penyetuju akhir. Atur di pengaturan lowongan.']);
            }
        }

        DB::transaction(function () use ($candidate, $target, $from, $reason): void {
            // Decisions belong to one round of "Keputusan akhir".
            if ($from === CandidateStage::FinalReview || $from->isFinal()) {
                $candidate->decisions()->delete();
            }

            $candidate->fill([
                'stage' => $target,
                'rejected_reason' => $target === CandidateStage::Rejected ? $reason : null,
                'decided_at' => $target === CandidateStage::Rejected ? CarbonImmutable::now() : null,
            ])->save();
        });

        if ($from === CandidateStage::FinalReview) {
            $this->resolve->handle($candidate, NotificationType::HiringDecisionNeeded);
        }

        $this->audit->log('hiring.stage_changed', $candidate, ['stage' => $from->value], [
            'stage' => $target->value,
            'reason_given' => $reason !== null,
        ], $actor);

        if ($target === CandidateStage::FinalReview) {
            Notification::send($approvers, new DecisionNeededNotification($candidate, $actor));
        }

        return $candidate;
    }
}
