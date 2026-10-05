<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Daily burn-up point (workspace_id + date is the primary key). Written only
 * by TakeProjectProgressSnapshots with an upsert; read-only elsewhere.
 *
 * @property string $workspace_id
 * @property CarbonImmutable $date
 * @property int $scope_count
 * @property int $done_count
 * @property string|null $scope_hours
 * @property string|null $done_hours
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 */
class ProjectProgressSnapshot extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'date';

    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'scope_count' => 'integer',
            'done_count' => 'integer',
            'scope_hours' => 'decimal:2',
            'done_hours' => 'decimal:2',
        ];
    }

    /**
     * @param  Builder<ProjectProgressSnapshot>  $query
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
}
