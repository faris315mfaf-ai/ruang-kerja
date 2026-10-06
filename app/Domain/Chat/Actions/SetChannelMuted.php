<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Services\ChannelMembership;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Mutes or unmutes a channel for one member (muted: no "Pesan baru"
 * notifications, mentions still notify). Muting a public channel joins it.
 */
final class SetChannelMuted
{
    public function __construct(private readonly ChannelMembership $membership) {}

    public function handle(Channel $channel, User $user, bool $muted): void
    {
        if ($channel->type === ChannelType::Public) {
            $this->membership->add($channel, [$user->id => ChannelRole::Member]);
        }

        $updated = ChannelMember::query()
            ->where('channel_id', $channel->id)
            ->where('user_id', $user->id)
            ->update(['muted' => $muted, 'updated_at' => now()]);

        if ($updated === 0) {
            throw ValidationException::withMessages(['muted' => 'Hanya anggota obrolan yang dapat membisukannya.']);
        }
    }
}
