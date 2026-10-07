<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Enums\ChannelType;
use App\Domain\Organization\Enums\UserStatus;
use App\Http\Resources\Chat\ChatPresenter;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Sidebar of /obrolan: the channels the viewer belongs to plus every public
 * channel, with unread count (top-level messages of others after the read
 * pointer), newest message preview and the members' read pointers. A fixed
 * number of queries regardless of the number of channels.
 */
final class ChatInbox
{
    /**
     * @return list<array<string, mixed>>
     */
    public function channels(User $viewer, ?Channel $including = null): array
    {
        $channels = $this->listed($viewer)
            ->when($including !== null, fn (Builder $query) => $query->orWhere('channels.id', $including?->id))
            ->get();

        return $this->present($viewer, $channels);
    }

    /**
     * Number of channels with unread messages (Dock / tab badge).
     */
    public function unreadChannels(User $viewer): int
    {
        return ChannelMember::query()
            ->where('channel_members.user_id', $viewer->id)
            ->whereExists(fn ($messages) => $messages->selectRaw('1')
                ->from('messages')
                ->whereColumn('messages.channel_id', 'channel_members.channel_id')
                ->whereNull('messages.parent_id')
                ->whereNull('messages.deleted_at')
                ->where('messages.user_id', '!=', $viewer->id)
                ->where(fn ($pointer) => $pointer->whereNull('channel_members.last_read_message_id')
                    ->orWhereColumn('messages.id', '>', 'channel_members.last_read_message_id')))
            ->whereIn('channel_members.channel_id', Channel::query()->visibleTo($viewer)->select('channels.id'))
            ->count();
    }

    /**
     * People of the company (mentions, new conversations, avatars).
     *
     * @return list<array<string, mixed>>
     */
    public function people(User $viewer): array
    {
        return array_values(User::query()
            ->where('company_id', $viewer->company_id)
            ->where('status', UserStatus::Active)
            ->with('position:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_url', 'position_id', 'company_id'])
            ->map(fn (User $user): array => ChatPresenter::person($user))
            ->all());
    }

    /**
     * @return Builder<Channel>
     */
    private function listed(User $viewer): Builder
    {
        return Channel::query()
            ->visibleTo($viewer)
            ->where(fn (Builder $listed) => $listed
                ->where('channels.type', ChannelType::Public->value)
                ->orWhereExists(fn ($member) => $member->selectRaw('1')
                    ->from('channel_members')
                    ->whereColumn('channel_members.channel_id', 'channels.id')
                    ->where('channel_members.user_id', $viewer->id)))
            ->with('workspace:id,key,name,color,archived_at,company_id,type,owner_id,visibility')
            ->select('channels.*')
            ->selectSub(fn ($latest) => $latest->select('id')
                ->from('messages')
                ->whereColumn('messages.channel_id', 'channels.id')
                ->whereNull('messages.parent_id')
                ->orderByDesc('messages.id')
                ->limit(1), 'latest_message_id')
            ->selectSub(fn ($unread) => $unread->selectRaw('count(*)')
                ->from('messages')
                ->join('channel_members as viewer_member', function ($join) use ($viewer): void {
                    $join->on('viewer_member.channel_id', '=', 'messages.channel_id')
                        ->where('viewer_member.user_id', '=', $viewer->id);
                })
                ->whereColumn('messages.channel_id', 'channels.id')
                ->whereNull('messages.parent_id')
                ->whereNull('messages.deleted_at')
                ->where('messages.user_id', '!=', $viewer->id)
                ->where(fn ($pointer) => $pointer->whereNull('viewer_member.last_read_message_id')
                    ->orWhereColumn('messages.id', '>', 'viewer_member.last_read_message_id')), 'unread_count')
            ->orderBy('channels.name')
            ->orderBy('channels.id');
    }

    /**
     * @param  Collection<int, Channel>  $channels
     * @return list<array<string, mixed>>
     */
    private function present(User $viewer, Collection $channels): array
    {
        if ($channels->isEmpty()) {
            return [];
        }

        $ids = $channels->pluck('id')->all();
        $members = ChannelMember::query()->whereIn('channel_id', $ids)->get()->groupBy('channel_id');
        $latestIds = $channels->pluck('latest_message_id')->filter()->values()->all();
        $latest = $latestIds === [] ? collect() : Message::withTrashed()
            ->whereIn('id', $latestIds)
            ->get(['id', 'channel_id', 'user_id', 'body_text', 'created_at', 'deleted_at'])
            ->keyBy('id');

        return array_values($channels->map(function (Channel $channel) use ($viewer, $members, $latest): array {
            /** @var \Illuminate\Support\Collection<int, ChannelMember> $channelMembers */
            $channelMembers = $members->get($channel->id, collect());
            $mine = $channelMembers->firstWhere('user_id', $viewer->id);
            $channel->setRelation('memberships', $channelMembers);
            $latestMessage = $latest->get($channel->getAttribute('latest_message_id'));

            return ChatPresenter::channel($channel, $channelMembers, [
                'unread_count' => (int) $channel->getAttribute('unread_count'),
                'last_message' => $latestMessage instanceof Message ? ChatPresenter::preview($latestMessage) : null,
                // Workspace channel members mirror the workspace members (SyncWorkspaceChannel).
                'can_post' => ! $channel->isArchived() && ($channel->type === ChannelType::Public || $mine !== null),
                'can_manage' => $mine?->role->canModerate() === true,
            ]);
        })->all());
    }
}
