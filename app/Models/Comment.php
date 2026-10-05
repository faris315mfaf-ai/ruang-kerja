<?php

namespace App\Models;

use App\Domain\Workspaces\Contracts\HasWorkspaceAttachments;
use Carbon\CarbonImmutable;
use Database\Factories\CommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use LogicException;

/**
 * Rich-text comment (docs/DATABASE.md §4 comments). `body` is a sanitized
 * Tiptap document (App\Domain\Tasks\Services\RichText); `edited_at` marks
 * "(diedit)". Soft-deleted comments stay in the timeline as "Komentar dihapus"
 * (their Drive attachments are hidden: the parent no longer resolves).
 *
 * @property string $id
 * @property string $commentable_type
 * @property string $commentable_id
 * @property string $user_id
 * @property array<string, mixed> $body
 * @property string $body_text
 * @property CarbonImmutable|null $edited_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property CarbonImmutable|null $deleted_at
 * @property-read Model $commentable
 * @property-read User $author
 */
#[Fillable(['commentable_type', 'commentable_id', 'user_id', 'body', 'body_text', 'edited_at'])]
class Comment extends Model implements HasWorkspaceAttachments
{
    /** @use HasFactory<CommentFactory> */
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'body' => 'array',
            'edited_at' => 'datetime',
        ];
    }

    /**
     * Comments on tasks the viewer may see.
     *
     * @param  Builder<Comment>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('commentable_type'), (new Task)->getMorphClass())
            ->whereIn($this->qualifyColumn('commentable_id'), Task::query()->visibleTo($viewer)->select('tasks.id'));
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function commentable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return MorphMany<Reaction, $this>
     */
    public function reactions(): MorphMany
    {
        return $this->morphMany(Reaction::class, 'reactable');
    }

    /**
     * @return MorphMany<Mention, $this>
     */
    public function mentions(): MorphMany
    {
        return $this->morphMany(Mention::class, 'mentionable');
    }

    /**
     * Drive attachments (Sprint 7): files go to the folder of the task's workspace.
     *
     * @return MorphMany<Attachment, $this>
     */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->oldest()->oldest('id');
    }

    public function attachmentWorkspace(): Workspace
    {
        $task = $this->commentable;

        if (! $task instanceof Task) {
            throw new LogicException("Comment [{$this->id}] does not belong to a task.");
        }

        return $task->attachmentWorkspace();
    }
}
