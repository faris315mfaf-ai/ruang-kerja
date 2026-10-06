<?php

namespace App\Domain\Automation\Jobs;

use App\Domain\Automation\Actions\RunAutomationRule;
use App\Domain\Automation\Enums\RuleTriggerType;
use App\Domain\Automation\Services\RuleMatcher;
use App\Models\AutomationRule;
use App\Models\Task;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Runs the active rules of a task's workspace that react to $trigger
 * ("pindah ke kategori $category", "dibuat berlabel"). Queued by
 * TriggerTaskAutomations so the person's request never waits for rules;
 * $depth / $chain carry the loop guard of AutomationContext.
 */
final class RunTaskAutomations implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [10, 60];

    /**
     * @param  list<string>  $chain
     */
    public function __construct(
        public readonly string $taskId,
        public readonly RuleTriggerType $trigger,
        public readonly ?string $category = null,
        public readonly int $depth = 0,
        public readonly array $chain = [],
    ) {}

    public function handle(RunAutomationRule $run, RuleMatcher $matcher): void
    {
        $task = Task::query()->with('workspace')->find($this->taskId);

        if ($task === null || $task->workspace->isArchived()) {
            return;
        }

        $rules = AutomationRule::query()
            ->where('workspace_id', $task->workspace_id)
            ->where('trigger_type', $this->trigger->value)
            ->where('is_active', true)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        foreach ($rules as $rule) {
            $fresh = $task->fresh(['workspace']);

            if ($fresh === null) {
                return;
            }

            if ($matcher->triggerMatches($rule, $fresh, $this->category)) {
                $run->handle($rule, $fresh, $this->depth, $this->chain);
            }
        }
    }
}
