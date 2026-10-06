<?php

namespace App\Domain\Hiring\Queries;

use App\Domain\Hiring\Enums\ReviewerRole;
use App\Domain\Hiring\Services\HiringAccess;
use App\Models\Candidate;
use App\Models\CandidateChecklistItem;
use App\Models\CandidateDecision;
use App\Models\CandidateNote;
use App\Models\HiringQuestion;
use App\Models\InterviewAnswer;
use App\Models\InterviewScore;
use App\Models\User;
use App\Policies\CandidatePolicy;

/**
 * Everything the candidate profile shows, shaped for
 * resources/js/features/hiring/types.ts (CandidateProfileProps). Points of
 * other interviewers are only included for HR and final approvers.
 * Constant number of queries.
 */
final class CandidateProfile
{
    public function __construct(
        private readonly HiringAccess $access,
        private readonly CandidatePolicy $policy,
        private readonly HiringPeople $people,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function for(Candidate $candidate, User $viewer): array
    {
        $candidate->load([
            'hiringPosition.division:id,name',
            'hiringPosition.questions',
            'answers',
            'scores',
            'checklistItems',
            'notes',
            'decisions',
        ]);

        $position = $candidate->hiringPosition;
        $manager = $this->access->isManager($viewer);
        $seeAll = $this->policy->canSeeAllScores($viewer, $candidate);
        $canScore = $this->policy->score($viewer, $candidate)->allowed();

        $people = $this->people->byId(array_values(array_filter([
            ...$position->interviewer_ids,
            ...$position->final_approver_ids,
            ...$candidate->scores->pluck('interviewer_id')->all(),
            ...$candidate->checklistItems->pluck('reviewer_id')->all(),
            ...$candidate->checklistItems->pluck('checked_by')->all(),
            ...$candidate->notes->pluck('author_id')->all(),
            ...$candidate->decisions->pluck('approver_id')->all(),
        ], fn (?string $id): bool => $id !== null)));

        $person = function (?string $id) use ($people): ?array {
            $user = $id !== null ? $people->get($id) : null;

            return $user !== null ? HiringPeople::person($user) : null;
        };

        $answers = $candidate->answers->keyBy('question_id');
        $scores = $candidate->scores->groupBy('question_id');

        $questions = $position->questions->map(function (HiringQuestion $question) use ($answers, $scores, $seeAll, $viewer, $person): array {
            /** @var InterviewAnswer|null $answer */
            $answer = $answers->get($question->id);
            $rows = $scores->get($question->id, collect());
            /** @var InterviewScore|null $mine */
            $mine = $rows->firstWhere('interviewer_id', $viewer->id);
            $average = $rows->isEmpty() ? null : round((float) $rows->avg('score'), 2);

            return [
                'id' => $question->id,
                'prompt' => $question->prompt,
                'guidance' => $question->guidance,
                'max_score' => $question->max_score,
                'answer' => $answer?->answer,
                'my_score' => $mine === null ? null : ['score' => $mine->score, 'note' => $mine->note],
                'scores' => $seeAll ? array_values($rows->sortBy('created_at')->map(fn (InterviewScore $score): array => [
                    'interviewer' => $person($score->interviewer_id),
                    'score' => $score->score,
                    'note' => $score->note,
                ])->all()) : null,
                'average' => $seeAll ? $average : null,
            ];
        })->values()->all();

        $checklist = $candidate->checklistItems->map(fn (CandidateChecklistItem $item): array => [
            'id' => $item->id,
            'label' => $item->label,
            'role' => $item->role->value,
            'required' => $item->is_required,
            'reviewer' => $person($item->reviewer_id),
            'checked_at' => $item->checked_at?->toIso8601String(),
            'checked_by' => $person($item->checked_by),
            'note' => $item->note,
            'can_check' => ! $candidate->stage->isFinal()
                && ($item->reviewer_id === null ? $manager : $item->reviewer_id === $viewer->id),
            'can_delete' => $manager && ! $item->isChecked(),
        ])->values()->all();

        $decisions = $candidate->decisions->keyBy('approver_id');

        return [
            'candidate' => [
                'id' => $candidate->id,
                'full_name' => $candidate->full_name,
                'email' => $candidate->email,
                'phone' => $candidate->phone,
                'cv_url' => $candidate->cv_url,
                'attachments' => $candidate->attachments,
                'form_answers' => $candidate->form_answers,
                'stage' => $candidate->stage->value,
                'rejected_reason' => $candidate->rejected_reason,
                'source' => $candidate->source->value,
                'applied_at' => $candidate->applied_at->toIso8601String(),
                'decided_at' => $candidate->decided_at?->toIso8601String(),
                'position' => [
                    'id' => $position->id,
                    'title' => $position->title,
                    'status' => $position->status->value,
                    'division' => $position->division?->name,
                ],
            ],
            'questions' => $questions,
            'checklist' => $checklist,
            'notes' => $candidate->notes->map(fn (CandidateNote $note): array => [
                'id' => $note->id,
                'body' => $note->body,
                'author' => $person($note->author_id),
                'created_at' => $note->created_at?->toIso8601String(),
                'edited_at' => $note->edited_at?->toIso8601String(),
                'can_edit' => $note->author_id === $viewer->id,
            ])->values()->all(),
            'decisions' => array_map(function (string $approverId) use ($decisions, $person): array {
                /** @var CandidateDecision|null $decision */
                $decision = $decisions->get($approverId);

                return [
                    'approver' => $person($approverId),
                    'decision' => $decision?->decision->value,
                    'note' => $decision?->note,
                    'decided_at' => $decision?->decided_at->toIso8601String(),
                ];
            }, $position->final_approver_ids),
            'reviewers' => [
                'interviewers' => array_values(array_filter(array_map($person, $position->interviewer_ids))),
                'approvers' => array_values(array_filter(array_map($person, $position->final_approver_ids))),
            ],
            'can' => [
                'manage' => $manager,
                'score' => $canScore,
                'decide' => $this->policy->decide($viewer, $candidate)->allowed(),
                'see_all_scores' => $seeAll,
            ],
            'blockers' => [
                // Required HR & interviewer items still open (needed before "Keputusan akhir").
                'before_final' => $candidate->checklistItems
                    ->filter(fn (CandidateChecklistItem $item): bool => $item->is_required && ! $item->isChecked() && $item->role !== ReviewerRole::Approver)
                    ->count(),
                // The viewer's own required approver items still open (needed before approving).
                'my_approval' => $candidate->checklistItems
                    ->filter(fn (CandidateChecklistItem $item): bool => $item->is_required && ! $item->isChecked() && $item->role === ReviewerRole::Approver && $item->reviewer_id === $viewer->id)
                    ->count(),
            ],
        ];
    }
}
