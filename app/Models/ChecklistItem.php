<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Checklist line of a task (edited in the task detail, Sprint 6).
 *
 * @property string $id
 * @property string $task_id
 * @property string $title
 * @property bool $is_done
 * @property string $position
 * @property string|null $done_by
 * @property CarbonImmutable|null $done_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Task $task
 */
#[Fillable(['task_id', 'title', 'is_done', 'position', 'done_by', 'done_at'])]
class ChecklistItem extends Model
{
    use HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_done' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_done' => 'boolean',
            'done_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
