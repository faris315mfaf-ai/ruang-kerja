<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Emoji reaction (docs/DATABASE.md §4). Unique per (reactable, user, emoji);
 * toggled by ToggleReaction.
 *
 * @property string $id
 * @property string $reactable_type
 * @property string $reactable_id
 * @property string $user_id
 * @property string $emoji
 * @property CarbonImmutable $created_at
 * @property-read Model $reactable
 * @property-read User $user
 */
#[Fillable(['reactable_type', 'reactable_id', 'user_id', 'emoji', 'created_at'])]
class Reaction extends Model
{
    use HasUlids;

    public const null UPDATED_AT = null;

    /**
     * Reactions offered by the picker (DESIGN: small, work-appropriate set).
     */
    public const array EMOJI = ['👍', '🎉', '❤️', '😄', '👀', '🙏', '✅', '🚀'];

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
     * @return MorphTo<Model, $this>
     */
    public function reactable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
