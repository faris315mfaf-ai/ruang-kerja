<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Enums\ChannelType;
use App\Models\Channel;
use App\Models\User;

/**
 * Display title of a channel for one viewer: "#nama" for named channels,
 * the other person for a DM, "Sari, Maya, Rizky" for a group.
 */
final class ChannelTitle
{
    public static function for(Channel $channel, ?User $viewer = null): string
    {
        if (! $channel->type->isDirect()) {
            return '#'.$channel->name;
        }

        $channel->loadMissing('members:id,name');

        $names = $channel->members
            ->reject(fn (User $member): bool => $viewer !== null && $member->id === $viewer->id)
            ->sortBy('name')
            ->map(fn (User $member): string => explode(' ', $member->name)[0])
            ->values();

        if ($channel->type === ChannelType::Dm) {
            $other = $channel->members->first(fn (User $member): bool => $viewer === null || $member->id !== $viewer->id);

            return $other->name ?? 'Pesan langsung';
        }

        return $names->take(3)->implode(', ').($names->count() > 3 ? ' +'.($names->count() - 3) : '');
    }
}
