<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Direction from Direksi ("Beri arahan"), optionally replying to one update.
 *
 * @property string $id
 * @property string $workspace_id
 * @property string|null $project_update_id
 * @property string|null $author_id
 * @property string $body
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 * @property-read ProjectUpdate|null $projectUpdate
 * @property-read User|null $author
 */
#[Fillable(['workspace_id', 'project_update_id', 'author_id', 'body', 'created_at'])]
class ProjectDirection extends Model
{
    use HasUlids;

    /**
     * @param  Builder<ProjectDirection>  $query
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
     * @return BelongsTo<ProjectUpdate, $this>
     */
    public function projectUpdate(): BelongsTo
    {
        return $this->belongsTo(ProjectUpdate::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
