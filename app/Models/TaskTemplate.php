<?php

namespace App\Models;

use App\Domain\Tasks\Enums\TaskPriority;
use Carbon\CarbonImmutable;
use Database\Factories\TaskTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Task template (docs/DATABASE.md §4 Otomasi). `workspace_id` null = for the
 * whole company; otherwise only usable inside that workspace. `labels` are
 * names (+ palette colour) matched in the target workspace when applied.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $workspace_id
 * @property string $name
 * @property string|null $description
 * @property string $title
 * @property TaskPriority $priority
 * @property string|null $estimate_hours
 * @property array<int, mixed> $checklist strings
 * @property array<int, mixed> $labels {name, color}
 * @property int $used_count
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace|null $workspace
 */
#[Fillable([
    'company_id', 'workspace_id', 'name', 'description', 'title', 'priority', 'estimate_hours',
    'checklist', 'labels', 'used_count', 'created_by',
])]
class TaskTemplate extends Model
{
    /** @use HasFactory<TaskTemplateFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'priority' => 0,
        'used_count' => 0,
        'checklist' => '[]',
        'labels' => '[]',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'priority' => TaskPriority::class,
            'estimate_hours' => 'decimal:2',
            'checklist' => 'array',
            'labels' => 'array',
            'used_count' => 'integer',
        ];
    }

    /**
     * Company-wide templates plus the templates of workspaces $user belongs to.
     *
     * @param  Builder<TaskTemplate>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where($this->qualifyColumn('company_id'), $user->company_id)
            ->where(fn (Builder $scope) => $scope
                ->whereNull($this->qualifyColumn('workspace_id'))
                ->orWhereIn($this->qualifyColumn('workspace_id'), Workspace::query()
                    ->where('company_id', $user->company_id)
                    ->joinedBy($user)
                    ->select('workspaces.id')));
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
