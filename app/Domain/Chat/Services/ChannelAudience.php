<?php

namespace App\Domain\Chat\Services;

use App\Domain\Organization\Enums\UserStatus;
use App\Models\Channel;
use App\Models\User;
use App\Policies\ChannelPolicy;
use Illuminate\Support\Collection;

/**
 * Who may read a channel (ChannelPolicy::canView): mentions only reach these
 * people, so no message content leaks to someone who cannot open it.
 */
final class ChannelAudience
{
    public function __construct(private readonly ChannelPolicy $policy) {}

    /**
     * Active users among `$userIds` who can read the channel.
     *
     * @param  list<string>  $userIds
     * @return Collection<int, User>
     */
    public function withAccess(Channel $channel, array $userIds): Collection
    {
        if ($userIds === []) {
            return collect();
        }

        return User::query()
            ->whereIn('id', array_values(array_unique($userIds)))
            ->where('company_id', $channel->company_id)
            ->where('status', UserStatus::Active)
            ->get()
            ->filter(fn (User $user): bool => $this->policy->canView($user, $channel))
            ->values();
    }
}
