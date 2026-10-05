<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\MilestoneFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Project milestone (docs/DATABASE.md §4). The status is derived by
 * App\Domain\Projects\Services\MilestoneStatusResolver.
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property string|null $description
 * @property CarbonImmutable $target_date
 * @property CarbonImmutable|null $completed_at
 * @property string $position
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 */
#[Fillable(['workspace_id', 'name', 'description', 'target_date', 'completed_at', 'position', 'created_by'])]
class Milestone extends Model
{
    /** @use HasFactory<MilestoneFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'target_date' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<Milestone>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('id'));
    }

    /**
     * Not completed and the target date is before $today (office date).
     *
     * @param  Builder<Milestone>  $query
     */
    public function scopeMissed(Builder $query, string $today): void
    {
        $query->whereNull($this->qualifyColumn('completed_at'))->where($this->qualifyColumn('target_date'), '<', $today);
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsToMany<Task, $this>
     */
    public function tasks(): BelongsToMany
    {
        return $this->belongsToMany(Task::class, 'milestone_tasks');
    }
}
