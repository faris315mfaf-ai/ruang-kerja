<?php

namespace App\Models;

use App\Domain\Chat\Enums\ChannelRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * channel_members row (composite key channel_id + user_id). Write it with
 * query builder calls (insert/update/delete), not save() on a loaded row.
 *
 * @property string $channel_id
 * @property string $user_id
 * @property ChannelRole $role
 * @property bool $muted
 * @property string|null $last_read_message_id
 * @property CarbonImmutable|null $joined_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Channel $channel
 * @property-read User $user
 */
class ChannelMember extends Pivot
{
    protected $table = 'channel_members';

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
            'role' => ChannelRole::class,
            'muted' => 'boolean',
            'joined_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
