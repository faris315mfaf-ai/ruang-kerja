<?php

namespace App\Domain\Hiring\Actions;

use App\Domain\Hiring\Enums\CandidateField;
use App\Domain\Hiring\Enums\PositionStatus;
use App\Domain\Hiring\Services\CandidateChecklist;
use App\Domain\Hiring\Services\HiringAccess;
use App\Domain\Organization\Services\AuditLogger;
use App\Models\Division;
use App\Models\HiringPosition;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * HR edits a position: details, status (opened_at / closed_at), the
 * interviewers ("tim luar") and final approvers, and the Google Form field
 * mapping. Reviewer changes re-sync the checklists of open candidates.
 */
final class UpdateHiringPosition
{
    public function __construct(
        private readonly HiringAccess $access,
        private readonly CandidateChecklist $checklist,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{title: string, division_id?: string|null, description?: string|null, status: PositionStatus, interviewer_ids: list<string>, final_approver_ids: list<string>, field_map: array<string, string|null>}  $data
     */
    public function handle(User $actor, HiringPosition $position, array $data): HiringPosition
    {
        $divisionId = $data['division_id'] ?? null;

        if ($divisionId !== null && ! Division::query()->whereKey($divisionId)->where('company_id', $position->company_id)->exists()) {
            $divisionId = null;
        }

        $old = [
            'status' => $position->status->value,
            'interviewer_ids' => $position->interviewer_ids,
            'final_approver_ids' => $position->final_approver_ids,
        ];

        $interviewers = $this->access->activeEmployeeIds($position->company_id, $data['interviewer_ids']);
        $approvers = $this->access->activeEmployeeIds($position->company_id, $data['final_approver_ids']);
        $reviewersChanged = $interviewers !== $position->interviewer_ids || $approvers !== $position->final_approver_ids;

        $fieldMap = [];

        foreach (CandidateField::cases() as $field) {
            $title = trim((string) ($data['field_map'][$field->value] ?? ''));

            if ($title !== '') {
                $fieldMap[$field->value] = mb_substr($title, 0, 500);
            }
        }

        DB::transaction(function () use ($position, $data, $divisionId, $interviewers, $approvers, $fieldMap, $reviewersChanged): void {
            $status = $data['status'];
            $now = CarbonImmutable::now();

            $position->fill([
                'title' => trim($data['title']),
                'division_id' => $divisionId,
                'description' => CreateHiringPosition::text($data['description'] ?? null),
                'status' => $status,
                'opened_at' => $status === PositionStatus::Open ? ($position->opened_at ?? $now) : $position->opened_at,
                'closed_at' => $status === PositionStatus::Closed ? ($position->closed_at ?? $now) : null,
                'interviewer_ids' => $interviewers,
                'final_approver_ids' => $approvers,
                'field_map' => $fieldMap,
            ])->save();

            if ($reviewersChanged) {
                $this->checklist->syncPosition($position);
            }
        });

        $new = [
            'status' => $position->status->value,
            'interviewer_ids' => $position->interviewer_ids,
            'final_approver_ids' => $position->final_approver_ids,
        ];

        if ($new !== $old) {
            $this->audit->log('hiring.position_updated', $position, $old, $new, $actor);
        }

        return $position;
    }
}
