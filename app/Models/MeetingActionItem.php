<?php

namespace App\Models;

use App\Domain\Tasks\Enums\TaskStatusCategory;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Follow-up ("tindak lanjut") of a meeting's minutes. "Jadikan tugas" links
 * it to a task (`task_id`); it counts as done when ticked off or when that
 * task is done.
 *
 * @property string $id
 * @property string $minutes_id
 * @property int $position
 * @property string $text
 * @property string|null $assignee_id
 * @property CarbonImmutable|null $due_date
 * @property string|null $task_id
 * @property CarbonImmutable|null $done_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read MeetingMinutes $minutes
 * @property-read User|null $assignee
 * @property-read Task|null $task
 */
#[Fillable(['minutes_id', 'position', 'text', 'assignee_id', 'due_date', 'task_id', 'done_at'])]
class MeetingActionItem extends Model
{
    use HasUlids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'position' => 0,
        'text' => '',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'due_date' => 'date',
            'done_at' => 'datetime',
        ];
    }

    public function isDone(): bool
    {
        return $this->done_at !== null
            || ($this->task_id !== null && $this->relationLoaded('task') && $this->task?->status_category === TaskStatusCategory::Done);
    }

    /**
     * @return BelongsTo<MeetingMinutes, $this>
     */
    public function minutes(): BelongsTo
    {
        return $this->belongsTo(MeetingMinutes::class, 'minutes_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
