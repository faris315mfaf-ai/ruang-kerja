<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Enums\ChannelRole;
use App\Models\Channel;

/**
 * Writes channel_members rows (composite key: query builder, never save()).
 */
final class ChannelMembership
{
    /**
     * Adds the users that are not members yet; returns the added ids.
     *
     * @param  array<string, ChannelRole>  $roles  user id => role
     * @return list<string>
     */
    public function add(Channel $channel, array $roles): array
    {
        if ($roles === []) {
            return [];
        }

        $now = now();
        /** @var list<string> $existing */
        $existing = $channel->memberships()->whereIn('user_id', array_keys($roles))->pluck('user_id')->all();
        $new = array_diff_key($roles, array_flip($existing));

        if ($new === []) {
            return [];
        }

        $channel->memberships()->getQuery()->insertOrIgnore(array_map(fn (string $userId, ChannelRole $role): array => [
            'channel_id' => $channel->id,
            'user_id' => $userId,
            'role' => $role->value,
            'muted' => false,
            'joined_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ], array_keys($new), array_values($new)));

        return array_map('strval', array_keys($new));
    }
}
