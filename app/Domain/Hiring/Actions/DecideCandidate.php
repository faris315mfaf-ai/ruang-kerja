<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\DecisionValue;
use App\Domain\Hiring\Enums\ReviewerRole;
use App\Domain\Hiring\Notifications\CandidateDecidedNotification;
use App\Domain\Hiring\Services\CandidateChecklist;
use App\Domain\Hiring\Services\HiringAccess;
use App\Domain\Notifications\Actions\ResolveNotificationsForSubject;
use App\Domain\Notifications\Enums\NotificationType;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Candidate;
use App\Models\CandidateDecision;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * A final approver decides on a candidate in "Keputusan akhir". The outcome
 * is automatic: one rejection → Ditolak (with that approver's reason); every
 * current final approver approved → Diterima. HR is notified of the outcome
 * and the approvers' "Perlu tindakan" items are resolved. Approving requires
 * the approver's own required checklist items to be ticked.
 */
final class DecideCandidate
{
    public function __construct(
        private readonly CandidateChecklist $checklist,
        private readonly HiringAccess $access,
        private readonly ResolveNotificationsForSubject $resolve,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(User $approver, Candidate $candidate, DecisionValue $decision, ?string $note = null): Candidate
    {
        $note = CreateHiringPosition::text($note);

        if ($decision === DecisionValue::Reject && $note === null) {
            throw ValidationException::withMessages(['note' => 'Tulis alasan penolakan.']);
        }

        if ($decision === DecisionValue::Approve) {
            $open = $this->checklist->openRequiredFor($candidate, $approver->id, ReviewerRole::Approver);

            if ($open > 0) {
                throw ValidationException::withMessages(['decision' => "Centang dulu {$open} butir checklist wajib Anda sebelum menyetujui."]);
            }
        }

        $outcome = DB::transaction(function () use ($approver, $candidate, $decision, $note): ?CandidateStage {
            // Serialise concurrent decisions of the approvers on this candidate.
            $locked = Candidate::query()->whereKey($candidate->id)->lockForUpdate()->firstOrFail();

            if ($locked->stage !== CandidateStage::FinalReview) {
                throw ValidationException::withMessages(['decision' => 'Kandidat ini sudah diputus atau tidak lagi di tahap Keputusan akhir.']);
            }

            CandidateDecision::query()->updateOrCreate(
                ['candidate_id' => $candidate->id, 'approver_id' => $approver->id],
                ['decision' => $decision, 'note' => $note, 'decided_at' => CarbonImmutable::now()],
            );

            $outcome = $this->outcome($candidate);

            if ($outcome !== null) {
                $candidate->fill([
                    'stage' => $outcome,
                    'rejected_reason' => $outcome === CandidateStage::Rejected ? $note : null,
                    'decided_at' => CarbonImmutable::now(),
                ])->save();
            }

            return $outcome;
        });

        $this->audit->log('hiring.decision_recorded', $candidate, null, [
            'decision' => $decision->value,
            'outcome' => $outcome?->value,
        ], $approver);

        if ($outcome !== null) {
            $this->resolve->handle($candidate, NotificationType::HiringDecisionNeeded);
            $this->audit->log('hiring.candidate_decided', $candidate, ['stage' => CandidateStage::FinalReview->value], [
                'stage' => $outcome->value,
            ], $approver);

            Notification::send($this->access->hrStaff($candidate->company_id), new CandidateDecidedNotification($candidate, $approver));
        } else {
            // This approver is done; the others still have the item.
            $this->resolveFor($candidate, $approver);
        }

        return $candidate;
    }

    /**
     * Rejected as soon as one current approver rejects; hired once every
     * current approver approved; otherwise still waiting.
     */
    private function outcome(Candidate $candidate): ?CandidateStage
    {
        $approverIds = $candidate->hiringPosition->final_approver_ids;
        $decisions = $candidate->decisions()->whereIn('approver_id', $approverIds)->get();

        if ($decisions->contains(fn (CandidateDecision $row): bool => $row->decision === DecisionValue::Reject)) {
            return CandidateStage::Rejected;
        }

        $approved = $decisions->filter(fn (CandidateDecision $row): bool => $row->decision === DecisionValue::Approve)
            ->pluck('approver_id')
            ->all();

        return $approverIds !== [] && array_diff($approverIds, $approved) === [] ? CandidateStage::Hired : null;
    }

    private function resolveFor(Candidate $candidate, User $approver): void
    {
        $approver->notifications()
            ->where('type', NotificationType::HiringDecisionNeeded->value)
            ->where('subject_type', $candidate->getMorphClass())
            ->where('subject_id', $candidate->id)
            ->whereNull('resolved_at')
            ->update(['resolved_at' => now(), 'updated_at' => now()]);
    }
}
