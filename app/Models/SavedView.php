<?php

namespace App\Models;

use App\Domain\Tasks\Enums\SavedViewLayout;
use Carbon\CarbonImmutable;
use Database\Factories\SavedViewFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Saved filters + layout (docs/DATABASE.md §4 saved_views). Personal views
 * belong to their owner; shared views are visible to everyone who may see
 * the workspace.
 *
 * @property string $id
 * @property string $user_id
 * @property string|null $workspace_id
 * @property string $name
 * @property SavedViewLayout $layout
 * @property array<string, mixed> $filters
 * @property array<string, mixed>|null $sort
 * @property bool $is_shared
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read User $user
 * @property-read Workspace|null $workspace
 */
#[Fillable(['user_id', 'workspace_id', 'name', 'layout', 'filters', 'sort', 'is_shared'])]
class SavedView extends Model
{
    /** @use HasFactory<SavedViewFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'filters' => '{}',
        'is_shared' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'layout' => SavedViewLayout::class,
            'filters' => 'array',
            'sort' => 'array',
            'is_shared' => 'boolean',
        ];
    }

    /**
     * Own views, plus shared views of workspaces the viewer may see.
     *
     * @param  Builder<SavedView>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where(function (Builder $scope) use ($viewer): void {
            $scope->where($this->qualifyColumn('user_id'), $viewer->id)
                ->orWhere(fn (Builder $shared) => $shared
                    ->where($this->qualifyColumn('is_shared'), true)
                    ->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('id')));
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
