<?php

namespace App\Http\Resources\Api\Hiring;

use App\Domain\Hiring\Enums\CandidateField;
use App\Domain\Hiring\Enums\CandidateSource;
use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Queries\HiringPeople;
use App\Models\Division;
use App\Models\HiringPosition;
use App\Models\HiringQuestion;
use App\Models\User;

/**
 * "Pengaturan lowongan" of the mobile app (HR & Super Admin): the same data
 * as the web settings page (details, status, reviewers, field mapping,
 * questions with their delete lock, pickers) — but the Google Form section
 * is desktop only: the webhook URL is shown for copying, the secret is NEVER
 * sent to the phone and "Buat ulang tautan & secret" has no API endpoint
 * (the app offers "Kirim tautan ke email saya" with `google_form.desktop_path`).
 */
final class PositionDetail
{
    public function __construct(private readonly HiringPeople $people) {}

    /**
     * @return array<string, mixed>
     */
    public function make(HiringPosition $position, User $viewer): array
    {
        $position->load([
            'division:id,name',
            'questions' => fn ($query) => $query->withExists(['answers', 'scores']),
        ]);

        $people = $this->people->byId([...$position->interviewer_ids, ...$position->final_approver_ids]);
        $person = fn (string $id): ?array => ($user = $people->get($id)) !== null
            ? [...HiringPeople::person($user), 'active' => $user->isActive()]
            : null;

        $candidates = $position->candidates()->withTrashed()->count();

        return [
            'position' => [
                'id' => $position->id,
                'title' => $position->title,
                'division_id' => $position->division_id,
                'division' => $position->division?->name,
                'description' => $position->description,
                'status' => $position->status->value,
                'status_label' => $position->status->label(),
                'opened_at' => $position->opened_at?->toIso8601String(),
                'closed_at' => $position->closed_at?->toIso8601String(),
                'interviewer_ids' => $position->interviewer_ids,
                'final_approver_ids' => $position->final_approver_ids,
                'interviewers' => array_values(array_filter(array_map($person, $position->interviewer_ids))),
                'approvers' => array_values(array_filter(array_map($person, $position->final_approver_ids))),
                'field_map' => (object) $position->field_map,
                'candidates_count' => $position->candidates()->count(),
            ],
            'questions' => self::questions($position),
            'field_defaults' => array_map(fn (CandidateField $field): array => [
                'field' => $field->value,
                'label' => $field->label(),
                'aliases' => $field->aliases(),
            ], CandidateField::cases()),
            'statuses' => array_map(fn (PositionStatus $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ], PositionStatus::cases()),
            'employees' => $this->people->options($viewer->company_id),
            'divisions' => self::divisions($viewer),
            'google_form' => [
                'desktop_only' => true,
                'webhook_url' => $position->webhookUrl(),
                'has_submissions' => $position->candidates()->withTrashed()->where('source', CandidateSource::GoogleForm)->exists(),
                'desktop_path' => '/hiring/lowongan/'.$position->id,
            ],
            'can' => [
                'update' => true,
                'delete' => $candidates === 0,
                'regenerate_webhook' => false,
            ],
        ];
    }

    /**
     * @return list<array{id: string, prompt: string, guidance: string|null, max_score: int, position: int, locked: bool, can_delete: bool}>
     */
    public static function questions(HiringPosition $position): array
    {
        if (! $position->relationLoaded('questions')) {
            $position->load(['questions' => fn ($query) => $query->withExists(['answers', 'scores'])]);
        }

        return array_values($position->questions->map(function (HiringQuestion $question): array {
            $locked = (bool) $question->getAttribute('answers_exists') || (bool) $question->getAttribute('scores_exists');

            return [
                'id' => $question->id,
                'prompt' => $question->prompt,
                'guidance' => $question->guidance,
                'max_score' => $question->max_score,
                'position' => $question->position,
                'locked' => $locked,
                'can_delete' => ! $locked,
            ];
        })->all());
    }

    /**
     * Divisions a position can belong to (the board unit excluded), by name.
     *
     * @return list<array{id: string, name: string}>
     */
    public static function divisions(User $user): array
    {
        return array_values(Division::query()
            ->where('company_id', $user->company_id)
            ->where('is_board', false)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Division $division): array => ['id' => $division->id, 'name' => $division->name])
            ->all());
    }
}
