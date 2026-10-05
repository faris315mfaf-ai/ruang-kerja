<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * "@person" inside a comment or task description (docs/DATABASE.md §4).
 * Rebuilt by SyncMentions on every save; only people who can see the
 * workspace get a row (and a notification).
 *
 * @property string $id
 * @property string $mentionable_type
 * @property string $mentionable_id
 * @property string $mentioned_user_id
 * @property string|null $created_by
 * @property CarbonImmutable $created_at
 * @property-read Model $mentionable
 * @property-read User $mentionedUser
 */
#[Fillable(['mentionable_type', 'mentionable_id', 'mentioned_user_id', 'created_by', 'created_at'])]
class Mention extends Model
{
    use HasUlids;

    public const null UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    /**
     * Mentions of the viewer (the only ones a user lists).
     *
     * @param  Builder<Mention>  $query
     */
    public function scopeVisibleTo(Builder $query, User $viewer): void
    {
        $query->where($this->qualifyColumn('mentioned_user_id'), $viewer->id);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function mentionable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function mentionedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentioned_user_id');
    }
}
