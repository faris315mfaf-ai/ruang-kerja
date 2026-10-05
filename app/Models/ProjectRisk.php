<?php

namespace App\Models;

use App\Domain\Projects\Enums\RiskLevel;
use App\Domain\Projects\Enums\RiskStatus;
use Carbon\CarbonImmutable;
use Database\Factories\ProjectRiskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Project risk (docs/DATABASE.md §4).
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $title
 * @property RiskLevel $level
 * @property string|null $owner_id
 * @property RiskStatus $status
 * @property CarbonImmutable|null $resolved_at
 * @property string|null $task_id
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 * @property-read User|null $owner
 * @property-read Task|null $task
 */
#[Fillable(['workspace_id', 'title', 'level', 'owner_id', 'status', 'resolved_at', 'task_id'])]
class ProjectRisk extends Model
{
    /** @use HasFactory<ProjectRiskFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'open',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'level' => RiskLevel::class,
            'status' => RiskStatus::class,
            'resolved_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<ProjectRisk>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('id'));
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
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
