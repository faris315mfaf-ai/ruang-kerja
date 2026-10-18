<?php

namespace App\Domain\Automation\Jobs;

use App\Domain\Automation\Actions\RunAutomationRule;
use App\Domain\Automation\Enums\RuleTriggerType;
use App\Domain\Tenancy\Concerns\CompanyAware;
use App\Domain\Tenancy\Scheduling\ForEachCompany;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\AutomationRule;
use App\Models\Task;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily 07.05 (office time of each company, CompanySchedule; after the deadline reminders): runs every active
 * "lewat tenggat" rule on the open tasks of its workspace whose due date is
 * before today. Once per (rule, task, due date): the run is logged with cycle
 * "overdue:<due date>" (unique), so re-running the job — or the next day —
 * does nothing, while a task whose due date is moved and missed again fires
 * again.
 */
final class RunOverdueAutomations implements ShouldBeUnique, ShouldQueue
{
    use CompanyAware;
    use Queueable;

    public int $uniqueFor = 600;

    /** Tasks per rule per run; the rest follow the next day. */
    public const int LIMIT_PER_RULE = 200;

    /** One lock per company (queued per company by CompanySchedule). */
    public function uniqueId(): string
    {
        return $this->companyUniqueId();
    }

    public function handle(RunAutomationRule $run): int
    {
        if (! (bool) config('features.automation')) {
            return 0;
        }

        return ForEachCompany::sum(fn (): int => $this->runRules($run));
    }

    private function runRules(RunAutomationRule $run): int
    {
        $today = CarbonImmutable::now(CurrentCompany::timezone())->toDateString();
        $runs = 0;

        AutomationRule::query()
            ->where('trigger_type', RuleTriggerType::TaskOverdue->value)
            ->when(CurrentCompany::id(), fn (Builder $query, string $company) => $query->where('company_id', $company))
            ->where('is_active', true)
            ->whereHas('workspace', fn ($workspace) => $workspace->whereNull('archived_at'))
            ->orderBy('id')
            ->each(function (AutomationRule $rule) use ($run, $today, &$runs): void {
                Task::query()
                    ->where('workspace_id', $rule->workspace_id)
                    ->open()
                    ->whereNotNull('due_date')
                    ->where('due_date', '<', $today)
                    ->whereNotExists(fn ($logged) => $logged->selectRaw('1')
                        ->from('automation_runs')
                        ->where('automation_runs.rule_id', $rule->id)
                        ->whereColumn('automation_runs.task_id', 'tasks.id')
                        ->whereRaw("automation_runs.cycle = 'overdue:' || tasks.due_date::text"))
                    ->with('workspace')
                    ->orderBy('due_date')
                    ->orderBy('id')
                    ->limit(self::LIMIT_PER_RULE)
                    ->get()
                    ->each(function (Task $task) use ($run, $rule, &$runs): void {
                        $cycle = 'overdue:'.$task->due_date?->toDateString();

                        if ($run->handle($rule, $task, cycle: $cycle) !== null) {
                            $runs++;
                        }
                    });
            });

        return $runs;
    }
}
