<?php

namespace App\Models;

use App\Domain\Tasks\Enums\TaskPriority;
use Carbon\CarbonImmutable;
use Database\Factories\RecurringTaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Recurring task (docs/DATABASE.md §4 Otomasi): the 07.00 job creates a task
 * on every date of `pattern` (App\Domain\Automation\Services\RecurrenceSchedule,
 * same rules as resources/js/features/automation/recurrence.ts) between
 * `starts_on` and `ends_on`.
 *
 * pattern: {kind: daily, weekdays_only} | {kind: weekly, weekdays[1–7]} |
 * {kind: monthly, day_of_month 1–31} | {kind: every_n_weeks, interval 1–12, weekdays}
 *
 * @property string $id
 * @property string $company_id
 * @property string $workspace_id
 * @property string $title
 * @property string|null $assignee_id
 * @property TaskPriority $priority
 * @property array<string, mixed> $pattern
 * @property CarbonImmutable $starts_on
 * @property CarbonImmutable|null $ends_on
 * @property bool $is_active
 * @property int $created_count
 * @property CarbonImmutable|null $last_created_on
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 * @property-read User|null $assignee
 * @property-read User|null $creator
 */
#[Fillable([
    'company_id', 'workspace_id', 'title', 'assignee_id', 'priority', 'pattern', 'starts_on', 'ends_on',
    'is_active', 'created_count', 'last_created_on', 'created_by',
])]
class RecurringTask extends Model
{
    /** @use HasFactory<RecurringTaskFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'priority' => 0,
        'is_active' => true,
        'created_count' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'priority' => TaskPriority::class,
            'pattern' => 'array',
            'starts_on' => 'date',
            'ends_on' => 'date',
            'is_active' => 'boolean',
            'created_count' => 'integer',
            'last_created_on' => 'date',
        ];
    }

    /**
     * Recurring tasks of the workspaces $user belongs to.
     *
     * @param  Builder<RecurringTask>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where($this->qualifyColumn('company_id'), $user->company_id)
            ->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()
                ->where('company_id', $user->company_id)
                ->joinedBy($user)
                ->select('workspaces.id'));
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
