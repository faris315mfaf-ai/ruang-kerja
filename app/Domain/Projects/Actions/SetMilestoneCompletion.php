<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\Milestone;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Marks a milestone done (now) or reopens it.
 */
final class SetMilestoneCompletion
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    public function handle(Milestone $milestone, User $actor, bool $completed): Milestone
    {
        if ($completed === ($milestone->completed_at !== null)) {
            return $milestone;
        }

        return DB::transaction(function () use ($milestone, $actor, $completed): Milestone {
            $milestone->completed_at = $completed ? now() : null;
            $milestone->save();

            $this->recordActivity->handle($milestone->workspace, $milestone, $actor, $completed ? ActivityEvent::MilestoneCompleted : ActivityEvent::MilestoneReopened, [
                'name' => $milestone->name,
                'target_date' => $milestone->target_date->toDateString(),
            ]);

            return $milestone;
        });
    }
}
