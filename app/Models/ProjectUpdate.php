<?php

namespace App\Models;

use App\Domain\Projects\Enums\ProjectHealth;
use Carbon\CarbonImmutable;
use Database\Factories\ProjectUpdateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Weekly project update written by the PIC (PRD M10). Inserting one updates
 * workspaces.health and workspaces.last_update_at (PostProjectUpdate).
 *
 * @property string $id
 * @property string $workspace_id
 * @property string|null $author_id
 * @property ProjectHealth $health
 * @property string $summary
 * @property string|null $blockers
 * @property string|null $decision_needed
 * @property CarbonImmutable|null $decision_resolved_at
 * @property string|null $decision_resolved_by
 * @property string|null $progress_snapshot
 * @property string|null $planned_snapshot
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 * @property-read User|null $author
 * @property-read User|null $resolver
 */
#[Fillable([
    'workspace_id', 'author_id', 'health', 'summary', 'blockers', 'decision_needed',
    'decision_resolved_at', 'decision_resolved_by', 'progress_snapshot', 'planned_snapshot', 'created_at',
])]
class ProjectUpdate extends Model
{
    /** @use HasFactory<ProjectUpdateFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'health' => ProjectHealth::class,
            'decision_resolved_at' => 'datetime',
            'progress_snapshot' => 'decimal:2',
            'planned_snapshot' => 'decimal:2',
        ];
    }

    public function hasOpenDecision(): bool
    {
        return $this->decision_needed !== null && $this->decision_resolved_at === null;
    }

    /**
     * @param  Builder<ProjectUpdate>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('id'));
    }

    /**
     * "Butuh keputusan": a decision was asked and Direksi has not resolved it.
     *
     * @param  Builder<ProjectUpdate>  $query
     */
    public function scopeOpenDecision(Builder $query): void
    {
        $query->whereNotNull($this->qualifyColumn('decision_needed'))->whereNull($this->qualifyColumn('decision_resolved_at'));
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
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decision_resolved_by');
    }

    /**
     * @return HasMany<ProjectDirection, $this>
     */
    public function directions(): HasMany
    {
        return $this->hasMany(ProjectDirection::class);
    }
}
