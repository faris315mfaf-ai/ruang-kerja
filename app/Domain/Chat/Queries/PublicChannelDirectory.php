<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Enums\ChannelType;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * "Jelajahi kanal": the active public channels of the viewer's company, with
 * the member count, whether the viewer already joined and the time of the
 * newest message. Paged and filterable by name/topic.
 */
final class PublicChannelDirectory
{
    /**
     * @return array{channels: list<array<string, mixed>>, total: int}
     */
    public function handle(User $viewer, ?string $search, int $page, int $perPage): array
    {
        $query = Channel::query()
            ->where('company_id', $viewer->company_id)
            ->where('type', ChannelType::Public->value)
            ->whereNull('archived_at');

        $search = trim((string) $search);

        if ($search !== '') {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->where(fn ($match) => $match->where('name', 'ilike', $like)->orWhere('topic', 'ilike', $like));
        }

        $total = (clone $query)->count();

        $channels = $query
            ->select('channels.*')
            ->selectSub(fn ($members) => $members->selectRaw('count(*)')
                ->from('channel_members')
                ->whereColumn('channel_members.channel_id', 'channels.id'), 'members_count')
            ->selectSub(fn ($members) => $members->selectRaw('count(*) > 0')
                ->from('channel_members')
                ->whereColumn('channel_members.channel_id', 'channels.id')
                ->where('channel_members.user_id', $viewer->id), 'is_member')
            ->selectSub(fn ($messages) => $messages->selectRaw('max(created_at)')
                ->from('messages')
                ->whereColumn('messages.channel_id', 'channels.id')
                ->whereNull('messages.deleted_at'), 'last_message_at')
            ->orderBy('name')
            ->orderBy('id')
            ->forPage($page, $perPage)
            ->get();

        return [
            'channels' => array_values($channels->map(fn (Channel $channel): array => [
                'id' => $channel->id,
                'name' => $channel->name,
                'title' => '#'.$channel->name,
                'topic' => $channel->topic,
                'members_count' => (int) $channel->getAttribute('members_count'),
                'is_member' => (bool) $channel->getAttribute('is_member'),
                'last_message_at' => $channel->getAttribute('last_message_at') === null
                    ? null
                    : Carbon::parse((string) $channel->getAttribute('last_message_at'))->toIso8601String(),
            ])->all()),
            'total' => $total,
        ];
    }
}
