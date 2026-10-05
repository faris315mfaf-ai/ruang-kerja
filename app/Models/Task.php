<?php

namespace App\Models;

use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Contracts\HasWorkspaceAttachments;
use Carbon\CarbonImmutable;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Task (docs/DATABASE.md §4). Numbered per workspace (KEY-number) by
 * CreateTask; `status_category` mirrors the column category.
 *
 * @property string $id
 * @property string $workspace_id
 * @property int $number
 * @property string|null $parent_id
 * @property string $title
 * @property array<string, mixed>|null $description
 * @property string|null $description_text
 * @property string $status_id
 * @property TaskStatusCategory $status_category
 * @property TaskPriority $priority
 * @property string $position
 * @property CarbonImmutable|null $start_date
 * @property CarbonImmutable|null $due_date
 * @property string|null $estimate_hours
 * @property string|null $created_by
 * @property CarbonImmutable|null $started_at
 * @property CarbonImmutable|null $completed_at
 * @property CarbonImmutable|null $canceled_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Workspace $workspace
 * @property-read TaskStatus $status
 * @property-read Task|null $parent
 * @property-read User|null $creator
 */
#[Fillable([
    'workspace_id', 'number', 'parent_id', 'title', 'description', 'description_text',
    'status_id', 'status_category', 'priority', 'position', 'start_date', 'due_date',
    'estimate_hours', 'created_by', 'started_at', 'completed_at', 'canceled_at',
])]
#[Hidden(['search_vector'])]
class Task extends Model implements HasWorkspaceAttachments
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'priority' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'description' => 'array',
            'status_category' => TaskStatusCategory::class,
            'priority' => TaskPriority::class,
            'start_date' => 'date',
            'due_date' => 'date',
            'estimate_hours' => 'decimal:2',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'canceled_at' => 'datetime',
        ];
    }

    /**
     * "OPS-142" (needs the workspace relation).
     */
    public function displayKey(): string
    {
        return $this->workspace->key.'-'.$this->number;
    }

    public function isClosed(): bool
    {
        return $this->status_category->isClosed();
    }

    /**
     * Tasks in workspaces $viewer may see (same rules as Workspace::visibleTo).
     *
     * @param  Builder<Task>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('id'));
    }

    /**
     * @param  Builder<Task>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereNotIn($this->qualifyColumn('status_category'), TaskStatusCategory::closedValues());
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<TaskStatus, $this>
     */
    public function status(): BelongsTo
    {
        return $this->belongsTo(TaskStatus::class, 'status_id');
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'parent_id');
    }

    /**
     * @return HasMany<Task, $this>
     */
    public function subtasks(): HasMany
    {
        return $this->hasMany(Task::class, 'parent_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_assignees')
            ->withPivot(['assigned_at', 'assigned_by']);
    }

    /**
     * @return BelongsToMany<Label, $this>
     */
    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(Label::class, 'task_labels');
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function watchers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_watchers')
            ->withPivot(['created_at']);
    }

    /**
     * @return HasMany<ChecklistItem, $this>
     */
    public function checklistItems(): HasMany
    {
        return $this->hasMany(ChecklistItem::class)->orderBy('position');
    }

    /**
     * @return MorphMany<Activity, $this>
     */
    public function activities(): MorphMany
    {
        return $this->morphMany(Activity::class, 'subject');
    }

    /**
     * Drive attachments (Sprint 7): files go to the workspace folder.
     *
     * @return MorphMany<Attachment, $this>
     */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest()->latest('id');
    }

    public function attachmentWorkspace(): Workspace
    {
        return $this->relationLoaded('workspace')
            ? $this->workspace
            : Workspace::query()->findOrFail($this->workspace_id);
    }
}
