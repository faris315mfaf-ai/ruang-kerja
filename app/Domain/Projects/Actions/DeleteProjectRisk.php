<?php

namespace App\Domain\Projects\Actions;

use App\Domain\Tasks\Actions\RecordActivity;
use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\ProjectRisk;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class DeleteProjectRisk
{
    public function __construct(private readonly RecordActivity $recordActivity) {}

    public function handle(ProjectRisk $risk, User $actor): void
    {
        DB::transaction(function () use ($risk, $actor): void {
            $this->recordActivity->handle($risk->workspace, $risk, $actor, ActivityEvent::RiskDeleted, [
                'title' => $risk->title,
                'level' => $risk->level->value,
            ]);

            $risk->delete();
        });
    }
}
