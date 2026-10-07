<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * task_comment_reads row: how far one person has read the comments of one
 * task (composite key task_id + user_id; docs/DATABASE.md §4). Written only by
 * App\Domain\Tasks\Actions\MarkCommentsRead with an upsert that never moves
 * the pointer backwards; read through App\Domain\Tasks\Queries\CommentReads.
 *
 * @property string $task_id
 * @property string $user_id
 * @property string $last_read_comment_id
 * @property CarbonImmutable $last_read_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Task $task
 * @property-read User $user
 */
class TaskCommentRead extends Pivot
{
    protected $table = 'task_comment_reads';

    public $incrementing = false;

    public $timestamps = true;

    /** @var list<string> */
    protected $guarded = [];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Task, $this>
     */
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
