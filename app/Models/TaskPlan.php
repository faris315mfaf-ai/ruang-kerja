<?php

namespace App\Models;

use App\Domain\Planner\Enums\PlanBucket;
use Carbon\CarbonImmutable;
use Database\Factories\TaskPlanFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One user's own plan for a task in "Ruang saya" (docs/DATABASE.md §4
 * task_plans). Private: only the owner reads or changes it (TaskPlanPolicy),
 * and it never changes the task itself.
 *
 * @property string $id
 * @property string $user_id
 * @property string $task_id
 * @property PlanBucket|null $bucket null = placed automatically by due date
 * @property CarbonImmutable|null $planned_for office date the bucket was set
 * @property string|null $position
 * @property CarbonImmutable|null $seen_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 * @property-read Task $task
 */
#[Fillable(['user_id', 'task_id', 'bucket', 'planned_for', 'position', 'seen_at'])]
class TaskPlan extends Model
{
    /** @use HasFactory<TaskPlanFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'bucket' => PlanBucket::class,
            'planned_for' => 'date',
            'seen_at' => 'datetime',
        ];
    }

    /**
     * The only way plans are listed: the owner's own rows.
     *
     * @param  Builder<TaskPlan>  $query
     */
    public function scopeOwnedBy(Builder $query, User $user): void
    {
        $query->where($this->qualifyColumn('user_id'), $user->id);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
