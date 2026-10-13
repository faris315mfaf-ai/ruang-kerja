<?php

namespace App\Http\Resources\Api\Hiring;

use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\CandidateStage;
use App\Domain\Hiring\Enums\DecisionValue;
use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Enums\ReviewerRole;
use App\Domain\Hiring\Queries\CandidateProfile;
use App\Models\Candidate;
use App\Models\User;

/**
 * Candidate profile of the mobile app (Profil · Wawancara · Checklist ·
 * Notulensi · Keputusan): the web CandidateProfile query verbatim (other
 * interviewers' points only for HR and final approvers, `can_check` /
 * `can_delete` / `can_edit` per row) plus what the phone renders without
 * re-deriving rules: labels, the Ringkasan block (checklist progress, score
 * total, decision tally), the "Pindahkan…" targets with their blockers, and
 * the viewer's own decision.
 */
final class CandidateDetail
{
    public function __construct(private readonly CandidateProfile $profile) {}

    /**
     * @return array<string, mixed>
     */
    public function make(Candidate $candidate, User $viewer): array
    {
        $data = $this->profile->for($candidate, $viewer);
        $stage = $candidate->stage;

        /** @var array<string, mixed> $info */
        $info = $data['candidate'];
        $info['stage_label'] = $stage->label();
        $info['source_label'] = $candidate->source->label();
        $info['is_manual'] = $candidate->source === CandidateSource::Manual;
        $info['position']['status_label'] = PositionStatus::from((string) $info['position']['status'])->label();
        $data['candidate'] = $info;

        /** @var list<array<string, mixed>> $checklist */
        $checklist = $data['checklist'];
        $data['checklist'] = array_map(fn (array $item): array => [
            ...$item,
            'role_label' => ReviewerRole::from((string) $item['role'])->label(),
            'mine' => $item['reviewer'] === null ? $data['can']['manage'] : ($item['reviewer']['id'] ?? null) === $viewer->id,
        ], $checklist);

        /** @var list<array<string, mixed>> $decisions */
        $decisions = $data['decisions'];
        $data['decisions'] = array_map(fn (array $row): array => [
            ...$row,
            'decision_label' => is_string($row['decision']) ? DecisionValue::from($row['decision'])->label() : 'Belum memutus',
        ], $decisions);

        $mine = collect($decisions)->first(fn (array $row): bool => ($row['approver']['id'] ?? null) === $viewer->id);
        $manage = (bool) $data['can']['manage'];

        $data['can'] = [
            ...$data['can'],
            'edit' => $manage,
            'move' => $manage,
            'answer' => $manage,
            'add_checklist' => $manage,
            'note' => true,
            'is_interviewer' => $candidate->hiringPosition->isInterviewer($viewer),
            'is_approver' => $candidate->hiringPosition->isApprover($viewer),
        ];

        $data['my_decision'] = $mine === null || $mine['decision'] === null ? null : [
            'decision' => $mine['decision'],
            'note' => $mine['note'],
            'decided_at' => $mine['decided_at'],
        ];

        $data['summary'] = $this->summary($data);
        $data['move_targets'] = $manage ? $this->moveTargets($stage, (int) $data['blockers']['before_final'], $data['reviewers']['approvers'] !== []) : [];

        return $data;
    }

    /**
     * Ringkasan (cincin checklist, total poin, status keputusan). The score
     * total is the web's: sum of per-question averages over the max points of
     * the scored questions — information only, never an automatic verdict.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function summary(array $data): array
    {
        /** @var list<array<string, mixed>> $checklist */
        $checklist = $data['checklist'];
        $required = array_filter($checklist, fn (array $item): bool => (bool) $item['required']);

        /** @var list<array<string, mixed>> $questions */
        $questions = $data['questions'];
        $score = null;

        if ($data['can']['see_all_scores']) {
            $scored = array_values(array_filter($questions, fn (array $question): bool => $question['average'] !== null));

            if ($scored !== []) {
                $byInterviewer = [];

                foreach ($questions as $question) {
                    foreach ($question['scores'] ?? [] as $row) {
                        $id = $row['interviewer']['id'] ?? null;

                        if ($id === null) {
                            continue;
                        }

                        $byInterviewer[$id] ??= ['interviewer' => $row['interviewer'], 'total' => 0, 'max' => 0, 'count' => 0];
                        $byInterviewer[$id]['total'] += (int) $row['score'];
                        $byInterviewer[$id]['max'] += (int) $question['max_score'];
                        $byInterviewer[$id]['count']++;
                    }
                }

                $score = [
                    'total' => round(array_sum(array_map(fn (array $question): float => (float) $question['average'], $scored)), 1),
                    'max' => array_sum(array_map(fn (array $question): int => (int) $question['max_score'], $scored)),
                    'scored_questions' => count($scored),
                    'questions' => count($questions),
                    'by_interviewer' => array_values($byInterviewer),
                ];
            }
        }

        $mine = array_values(array_filter($questions, fn (array $question): bool => $question['my_score'] !== null));

        /** @var list<array<string, mixed>> $decisions */
        $decisions = $data['decisions'];

        return [
            'checklist' => [
                'done' => count(array_filter($required, fn (array $item): bool => $item['checked_at'] !== null)),
                'total' => count($required),
            ],
            'score' => $score,
            'my_score' => $data['can']['score'] || $mine !== [] ? [
                'total' => array_sum(array_map(fn (array $question): int => (int) $question['my_score']['score'], $mine)),
                'max' => array_sum(array_map(fn (array $question): int => (int) $question['max_score'], $mine)),
                'scored_questions' => count($mine),
                'questions' => count($questions),
            ] : null,
            'decisions' => [
                'approved' => count(array_filter($decisions, fn (array $row): bool => $row['decision'] === DecisionValue::Approve->value)),
                'rejected' => count(array_filter($decisions, fn (array $row): bool => $row['decision'] === DecisionValue::Reject->value)),
                'pending' => count(array_filter($decisions, fn (array $row): bool => $row['decision'] === null)),
                'total' => count($decisions),
            ],
        ];
    }

    /**
     * Stages HR may pick in "Pindahkan…" (never Diterima; Ditolak needs a
     * reason; Keputusan akhir blocked while required HR/interviewer items are
     * open or the position has no final approver). The server re-checks.
     *
     * @return list<array{stage: string, label: string, requires_reason: bool, blocked: string|null}>
     */
    private function moveTargets(CandidateStage $current, int $openBeforeFinal, bool $hasApprovers): array
    {
        $targets = [];

        foreach (CandidateStage::cases() as $stage) {
            if ($stage === $current || ! $stage->isManualTarget()) {
                continue;
            }

            $blocked = null;

            if ($stage === CandidateStage::FinalReview) {
                $blocked = match (true) {
                    $openBeforeFinal > 0 => "Masih ada {$openBeforeFinal} butir checklist wajib (HR & pewawancara) yang belum dicentang.",
                    ! $hasApprovers => 'Lowongan ini belum punya penyetuju akhir. Atur di pengaturan lowongan.',
                    default => null,
                };
            }

            $targets[] = [
                'stage' => $stage->value,
                'label' => $stage->label(),
                'requires_reason' => $stage === CandidateStage::Rejected,
                'blocked' => $blocked,
            ];
        }

        return $targets;
    }
}
