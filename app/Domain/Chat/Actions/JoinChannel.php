<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Enums\ChannelRole;
use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Chat\Services\ChannelMembership;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Explicit "Gabung kanal" for a public channel (the web joins implicitly on
 * the first message / mute, PostMessage and SetChannelMuted). Returns true
 * when the user was not a member yet.
 */
final class JoinChannel
{
    public function __construct(private readonly ChannelMembership $membership) {}

    public function handle(Channel $channel, User $user): bool
    {
        if ($channel->type !== ChannelType::Public) {
            throw ValidationException::withMessages(['channel' => 'Hanya channel publik yang bisa digabung.']);
        }

        if ($channel->isArchived()) {
            throw ValidationException::withMessages(['channel' => 'Obrolan ini sudah diarsipkan dan hanya bisa dibaca.']);
        }

        return $this->membership->add($channel, [$user->id => ChannelRole::Member]) !== [];
    }
}
