<?php

namespace App\Models;

use App\Domain\Workspaces\Enums\WorkspaceType;
use Carbon\CarbonImmutable;
use Database\Factories\WorkspaceTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Workspace template (docs/DATABASE.md §4 Otomasi): status columns and labels
 * saved from a team/project workspace ("Simpan sebagai template") and copied
 * into new workspaces. Company-wide.
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property string|null $description
 * @property WorkspaceType $type
 * @property array<int, mixed> $statuses {name, category, color}
 * @property array<int, mixed> $labels {name, color}
 * @property int $used_count
 * @property string|null $source_workspace_id
 * @property string|null $created_by
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
#[Fillable(['company_id', 'name', 'description', 'type', 'statuses', 'labels', 'used_count', 'source_workspace_id', 'created_by'])]
class WorkspaceTemplate extends Model
{
    /** @use HasFactory<WorkspaceTemplateFactory> */
    use HasFactory, HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'used_count' => 0,
        'labels' => '[]',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => WorkspaceType::class,
            'statuses' => 'array',
            'labels' => 'array',
            'used_count' => 'integer',
        ];
    }

    /**
     * @param  Builder<WorkspaceTemplate>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where($this->qualifyColumn('company_id'), $user->company_id);
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function sourceWorkspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class, 'source_workspace_id');
    }
}
