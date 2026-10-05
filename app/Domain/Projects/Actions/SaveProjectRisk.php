<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Projects\Enums\RiskLevel;
use App\Domain\Projects\Enums\RiskStatus;
use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\ProjectRisk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

/**
 * Creates or edits a project risk; resolving stamps resolved_at.
 */
final class SaveProjectRisk
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    /**
     * @param  array{title: string, level: RiskLevel, owner_id?: string|null, task_id?: string|null, status?: RiskStatus}  $data
     */
    public function handle(Workspace $workspace, User $actor, array $data, ?ProjectRisk $risk = null): ProjectRisk
    {
        return DB::transaction(function () use ($workspace, $actor, $data, $risk): ProjectRisk {
            $creating = $risk === null;
            $risk ??= new ProjectRisk(['workspace_id' => $workspace->id]);

            $risk->fill([
                'title' => $data['title'],
                'level' => $data['level'],
                'owner_id' => $data['owner_id'] ?? null,
                'task_id' => $data['task_id'] ?? null,
            ]);

            $status = $data['status'] ?? ($risk->status ?? RiskStatus::Open);
            $risk->status = $status;
            $risk->resolved_at = $status === RiskStatus::Resolved ? ($risk->resolved_at ?? now()) : null;

            $resolvedNow = $risk->isDirty('status') && $status === RiskStatus::Resolved;
            $dirty = $risk->getDirty();
            $risk->save();

            if ($creating || $dirty !== []) {
                $event = match (true) {
                    $creating => ActivityEvent::RiskCreated,
                    $resolvedNow => ActivityEvent::RiskResolved,
                    default => ActivityEvent::RiskUpdated,
                };

                $this->recordActivity->handle($workspace, $risk, $actor, $event, [
                    'title' => $risk->title,
                    'level' => $risk->level->value,
                    'status' => $risk->status->value,
                ]);
            }

            return $risk;
        });
    }
}
