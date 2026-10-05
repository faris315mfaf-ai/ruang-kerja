<?php

namespace App\Domain\Tasks\Actions;

use App\Domain\Tasks\Enums\ActivityEvent;
use App\Models\Activity;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Model;

/**
 * Appends one row to the workspace feed (activities).
 */
final class RecordActivity
{
    /**
     * @param  array<string, mixed>  $properties
     */
    public function handle(Workspace $workspace, Model $subject, ?User $causer, ActivityEvent $event, array $properties = []): Activity
    {
        return Activity::query()->create([
            'workspace_id' => $workspace->id,
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => (string) $subject->getKey(),
            'causer_id' => $causer?->id,
            'event' => $event->value,
            'properties' => $properties === [] ? null : $properties,
            'created_at' => now(),
        ]);
    }
}
