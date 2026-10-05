<?php

namespace App\Models;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use Carbon\CarbonImmutable;
use Database\Factories\TaskStatusFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Board column of one workspace. `category` drives metrics, `position` is a
 * Lexorank key (byte-ordered column).
 *
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property TaskStatusCategory $category
 * @property string $color
 * @property string $position
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Workspace $workspace
 */
#[Fillable(['workspace_id', 'name', 'category', 'color', 'position'])]
class TaskStatus extends Model
{
    /** @use HasFactory<TaskStatusFactory> */
    use HasFactory, HasUlids;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category' => TaskStatusCategory::class,
        ];
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return HasMany<Task, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'status_id');
    }
}
