<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\Milestone;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Deletes a milestone (links to tasks go with it; tasks stay).
 */
final class DeleteMilestone
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    public function handle(Milestone $milestone, User $actor): void
    {
        DB::transaction(function () use ($milestone, $actor): void {
            $this->recordActivity->handle($milestone->workspace, $milestone, $actor, ActivityEvent::MilestoneDeleted, [
                'name' => $milestone->name,
                'target_date' => $milestone->target_date->toDateString(),
            ]);

            $milestone->delete();
        });
    }
}
