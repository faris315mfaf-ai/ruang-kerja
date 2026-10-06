<?php

namespace App\Domain\Automation\Queries;

use App\Domain\Automation\Enums\RunResult;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Props of /otomasi (features/automation/types.ts AutomationProps): the
 * rules of the workspaces $user belongs to, the run log of the last 7 days
 * and the KPI counts over exactly those 7 days.
 */
final class AutomationPage
{
    public const int LOG_DAYS = 7;

    public const int LOG_LIMIT = 60;

    public function __construct(private readonly AutomationWorkspaces $workspaces) {}

    /**
     * @return array<string, mixed>
     */
    public function for(User $user, CarbonImmutable $now): array
    {
        $options = $this->workspaces->for($user);
        $manageable = collect($options['workspaces'])->where('can_manage', true)->pluck('id')->flip();

        $rules = AutomationRule::query()
            ->visibleTo($user)
            ->latest('created_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (AutomationRule $rule): array => [
                'id' => $rule->id,
                'name' => $rule->name,
                'workspace_id' => $rule->workspace_id,
                'trigger' => $rule->trigger,
                'condition' => $rule->condition,
                'actions' => $rule->actions,
                'is_active' => $rule->is_active,
                'last_run_at' => $rule->last_run_at?->toIso8601String(),
                'run_count' => $rule->run_count,
                'created_by' => $rule->created_by,
                'can_manage' => $manageable->has($rule->workspace_id),
            ])
            ->values()
            ->all();

        $since = $now->subDays(self::LOG_DAYS);
        $recent = AutomationRun::query()->visibleTo($user)->where('ran_at', '>=', $since);

        $stats = (clone $recent)->toBase()
            ->selectRaw('count(*) as total')
            ->selectRaw('count(*) filter (where result = ?) as success', [RunResult::Success->value])
            ->selectRaw('count(*) filter (where result = ?) as failed', [RunResult::Failed->value])
            ->first();

        $runs = $recent
            ->latest('ran_at')
            ->orderByDesc('id')
            ->limit(self::LOG_LIMIT)
            ->get()
            ->map(fn (AutomationRun $run): array => [
                'id' => $run->id,
                'rule_id' => $run->rule_id,
                'task_key' => $run->task_key,
                'task_title' => $run->task_title,
                'task_id' => $run->task_id,
                'result' => $run->result->value,
                'detail' => $run->detail,
                'ran_at' => $run->ran_at->toIso8601String(),
            ])
            ->values()
            ->all();

        return [
            ...$options,
            'rules' => $rules,
            'runs' => $runs,
            'stats' => [
                'runs_7d' => (int) ($stats->total ?? 0),
                'success_7d' => (int) ($stats->success ?? 0),
                'failed_7d' => (int) ($stats->failed ?? 0),
            ],
            'now' => $now->toIso8601String(),
        ];
    }
}
