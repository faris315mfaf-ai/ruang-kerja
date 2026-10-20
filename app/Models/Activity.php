<?php

namespace App\Models;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Append-only feed entry (docs/DATABASE.md §4 activities). `event` is a string
 * such as `task.created`; Sprint 5 values live in ActivityEvent.
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $subject_type
 * @property string $subject_id
 * @property string|null $causer_id
 * @property string $event
 * @property array<string, mixed>|null $properties
 * @property CarbonImmutable $created_at
 * @property-read Workspace $workspace
 * @property-read Model|null $subject
 * @property-read User|null $causer
 */
#[Fillable(['workspace_id', 'subject_type', 'subject_id', 'causer_id', 'event', 'properties', 'created_at'])]
class Activity extends Model
{
    use HasUlids;

    public const null UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'properties' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<Activity>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->whereIn($this->qualifyColumn('workspace_id'), Workspace::query()->visibleTo($viewer)->select('id'));
        $this->scopeRespectingPrivacyOf($query, $viewer);
    }

    /**
     * Private tasks (Penugasan HR): in a `tasks_private` workspace a viewer who
     * is not its owner/admin only sees the activity of tasks assigned to
     * them — not workspace events (members added …) nor other tasks.
     *
     * @param  Builder<Activity>  $query
     */
    public function scopeRespectingPrivacyOf(Builder $query, User $viewer): void
    {
        $workspaceId = $this->qualifyColumn('workspace_id');

        $query->where(function (Builder $scope) use ($viewer, $workspaceId): void {
            $scope->whereNotIn($workspaceId, Workspace::withTrashed()->where('tasks_private', true)->select('id'))
                ->orWhereIn($workspaceId, WorkspaceMember::query()
                    ->where('user_id', $viewer->id)
                    ->whereIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
                    ->select('workspace_id'))
                ->orWhere(fn (Builder $own) => $own
                    ->where($this->qualifyColumn('subject_type'), (new Task)->getMorphClass())
                    ->whereIn($this->qualifyColumn('subject_id'), Task::query()->respectingPrivacyOf($viewer)->select('tasks.id')));
        });
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function causer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'causer_id');
    }
}
