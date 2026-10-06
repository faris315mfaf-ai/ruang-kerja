<?php

namespace App\Domain\Automation\Queries;

use App\Models\RecurringTask;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Props of /otomasi/berulang (features/automation/types.ts RecurringProps).
 * `can_manage` per item mirrors RecurringTaskPolicy::update (creator who may
 * still create tasks, or the workspace owner/admin).
 */
final class RecurringPage
{
    public function __construct(private readonly AutomationWorkspaces $workspaces) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user, CarbonImmutable $now): array
    {
        $options = $this->workspaces->for($user);
        $rights = collect($options['workspaces'])->keyBy('id');

        $items = RecurringTask::query()
            ->visibleTo($user)
            ->latest('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(function (RecurringTask $recurring) use ($rights, $user): array {
                $workspace = $rights->get($recurring->workspace_id);
                $canManage = ($workspace['can_manage'] ?? false)
                    || ($recurring->created_by === $user->id && ($workspace['can_edit_tasks'] ?? false));

                return [
                    'id' => $recurring->id,
                    'title' => $recurring->title,
                    'workspace_id' => $recurring->workspace_id,
                    'assignee_id' => $recurring->assignee_id,
                    'priority' => $recurring->priority->value,
                    'pattern' => $recurring->pattern,
                    'starts_on' => $recurring->starts_on->toDateString(),
                    'ends_on' => $recurring->ends_on?->toDateString(),
                    'is_active' => $recurring->is_active,
                    'created_count' => $recurring->created_count,
                    'last_created_on' => $recurring->last_created_on?->toDateString(),
                    'can_manage' => $canManage,
                ];
            })
            ->values()
            ->all();

        return [
            ...$options,
            'recurring' => $items,
            'today' => $now->setTimezone(config()->string('app.office_timezone'))->toDateString(),
        ];
    }
}
