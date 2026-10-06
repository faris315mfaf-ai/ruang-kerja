<?php

namespace App\Models;

use App\Domain\Automation\Enums\RunResult;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One execution of an automation rule on a task (log "Log eksekusi").
 * Append-only; `task_key` / `task_title` are snapshots.
 *
 * @property string $id
 * @property string $rule_id
 * @property string|null $task_id
 * @property string $task_key
 * @property string $task_title
 * @property RunResult $result
 * @property string $detail
 * @property int $depth
 * @property string|null $cycle
 * @property CarbonImmutable $ran_at
 * @property-read AutomationRule $rule
 * @property-read Task|null $task
 */
#[Fillable(['rule_id', 'task_id', 'task_key', 'task_title', 'result', 'detail', 'depth', 'cycle', 'ran_at'])]
class AutomationRun extends Model
{
    use HasUlids;

    public $timestamps = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'result' => RunResult::class,
            'depth' => 'integer',
            'ran_at' => 'datetime',
        ];
    }

    /**
     * Runs of the rules $user may see (AutomationRule::visibleTo).
     *
     * @param  Builder<AutomationRun>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->whereIn($this->qualifyColumn('rule_id'), AutomationRule::query()->visibleTo($user)->select('automation_rules.id'));
    }

    /**
     * @return BelongsTo<AutomationRule, $this>
     */
    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class, 'rule_id');
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
