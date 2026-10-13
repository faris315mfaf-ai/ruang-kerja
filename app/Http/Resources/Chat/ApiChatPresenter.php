<?php

namespace App\Http\Resources\Chat;

use App\Domain\Chat\Enums\ChannelType;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\Message;
use App\Models\User;
use App\Policies\ChannelPolicy;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Mobile (API v1) shapes of the Obrolan screens, on top of the web
 * ChatPresenter: messages get the author, thread summary, mentions,
 * reaction summary and `can` flags the app needs without a second request;
 * channels get a display title, member names (DM/group) and the detail view.
 * A fixed number of queries per page, never one per message.
 */
final class ApiChatPresenter
{
    public const string DELETED_LABEL = 'Pesan ini dihapus';

    public const int PARTICIPANTS = 3;

    public function __construct(private readonly ChannelPolicy $policy) {}

    /**
     * @param  list<array<string, mixed>>  $messages  ChatPresenter::message() rows
     * @return list<array<string, mixed>>
     */
    public function messages(array $messages, Channel $channel, User $viewer): array
    {
        if ($messages === []) {
            return [];
        }

        $ids = array_map(fn (array $message): string => (string) $message['id'], $messages);
        $rootIds = array_values(array_map(
            fn (array $message): string => (string) $message['id'],
            array_filter($messages, fn (array $message): bool => $message['parent_id'] === null),
        ));

        $mentions = $this->mentions($ids);
        $threads = $this->threads($rootIds);

        $userIds = collect($messages)->pluck('user_id')
            ->merge(collect($mentions)->flatten())
            ->merge(collect($threads)->flatMap(fn (array $thread): array => $thread['participant_ids']))
            ->filter()->unique()->values()->all();

        $names = User::query()->whereIn('id', $userIds)->pluck('name', 'id');

        $canPost = $this->policy->canPost($viewer, $channel);
        $canManage = $canPost && $this->policy->canManage($viewer, $channel);

        return array_map(function (array $message) use ($viewer, $mentions, $threads, $names, $canPost, $canManage): array {
            $id = (string) $message['id'];
            $deleted = $message['deleted_at'] !== null;
            $own = $message['user_id'] === $viewer->id;
            $authorName = $names[$message['user_id']] ?? null;
            $thread = $threads[$id] ?? null;

            $message['penulis'] = [
                'id' => $message['user_id'],
                'nama' => $authorName,
                'initials' => self::initials($authorName),
            ];
            $message['author'] = [
                'id' => $message['user_id'],
                'name' => $authorName,
                'initials' => self::initials($authorName),
            ];
            $message['deleted'] = $deleted;
            $message['deleted_label'] = $deleted ? self::DELETED_LABEL : null;
            $message['reaction_summary'] = array_map(fn (array $reaction): array => [
                'emoji' => $reaction['emoji'],
                'count' => count($reaction['user_ids']),
                'mine' => in_array($viewer->id, $reaction['user_ids'], true),
            ], $message['reactions']);
            $message['mentions'] = $deleted ? [] : array_map(fn (string $userId): array => [
                'user_id' => $userId,
                'name' => $names[$userId] ?? null,
            ], $mentions[$id] ?? []);

            if ($message['parent_id'] === null) {
                $message['reply_count'] = $thread['reply_count'] ?? 0;
                $message['last_reply_at'] = $thread['last_reply_at'] ?? null;
                $message['participants'] = array_map(fn (string $userId): array => [
                    'id' => $userId,
                    'name' => $names[$userId] ?? null,
                    'initials' => self::initials($names[$userId] ?? null),
                ], $thread['participant_ids'] ?? []);
            }

            $message['can'] = [
                'edit' => $canPost && ! $deleted && $own,
                'delete' => $canPost && ! $deleted && ($own || $canManage),
                'react' => $canPost && ! $deleted,
                'reply' => $canPost && ! $deleted && $message['parent_id'] === null,
            ];

            return $message;
        }, $messages);
    }

    /**
     * Channel rows of GET /obrolan: adds the display title, `is_member`,
     * `members_count`, and member names for DMs and groups (public channels
     * can have the whole company as members, so those stay ids only).
     *
     * @param  list<array<string, mixed>>  $channels  ChatInbox rows
     * @return list<array<string, mixed>>
     */
    public function channels(array $channels, User $viewer): array
    {
        $directUserIds = collect($channels)
            ->filter(fn (array $channel): bool => in_array($channel['type'], [ChannelType::Dm->value, ChannelType::Group->value], true))
            ->flatMap(fn (array $channel): array => array_column($channel['members'], 'user_id'))
            ->unique()->values()->all();

        $names = $directUserIds === [] ? collect() : User::query()->whereIn('id', $directUserIds)->pluck('name', 'id');

        return array_map(function (array $channel) use ($viewer, $names): array {
            $direct = in_array($channel['type'], [ChannelType::Dm->value, ChannelType::Group->value], true);
            $memberIds = array_column($channel['members'], 'user_id');

            if ($direct) {
                $channel['members'] = array_values(array_map(fn (array $member): array => [
                    ...$member,
                    'name' => $names[$member['user_id']] ?? null,
                    'initials' => self::initials($names[$member['user_id']] ?? null),
                ], $channel['members']));
            }

            $channel['title'] = $this->title($channel['type'], $channel['name'], $direct ? $this->memberNames($memberIds, $names->all(), $viewer->id) : []);
            $channel['is_member'] = in_array($viewer->id, $memberIds, true);
            $channel['members_count'] = count($memberIds);

            return $channel;
        }, $channels);
    }

    /**
     * Detail screen of one conversation.
     *
     * @return array<string, mixed>
     */
    public function detail(Channel $channel, User $viewer, int $memberLimit = 50): array
    {
        $channel->unsetRelation('memberships');
        $channel->loadMissing('workspace:id,key,name,color,archived_at,company_id,type,owner_id,visibility');
        $mine = $channel->membershipOf($viewer);
        $people = $this->members($channel, $memberLimit, 1);
        $direct = $channel->type->isDirect();
        $total = $channel->memberships()->count();

        return [
            'id' => $channel->id,
            'type' => $channel->type->value,
            'name' => $channel->name,
            'topic' => $channel->topic,
            'title' => $this->title(
                $channel->type->value,
                $channel->name,
                $direct ? $this->memberNames(
                    array_values($channel->memberships()->pluck('user_id')->all()),
                    User::query()->whereIn('id', $channel->memberships()->select('user_id'))->pluck('name', 'id')->all(),
                    $viewer->id,
                ) : [],
            ),
            'workspace' => $channel->workspace === null ? null : [
                'id' => $channel->workspace->id,
                'key' => $channel->workspace->key,
                'name' => $channel->workspace->name,
                'color' => $channel->workspace->color ?? 'teal',
                'url' => '/w/'.$channel->workspace->key,
            ],
            'archived' => $channel->isArchived(),
            'archived_at' => $channel->archived_at?->toIso8601String(),
            'created_at' => $channel->created_at?->toIso8601String(),
            'is_member' => $mine !== null,
            'my_role' => $mine?->role->value,
            'muted' => $mine->muted ?? false,
            'can_post' => $this->policy->canPost($viewer, $channel),
            'can_manage' => $this->policy->canManage($viewer, $channel),
            'members_count' => $total,
            'members' => $people,
            'members_has_more' => $total > $memberLimit,
        ];
    }

    /**
     * Members, owners and admins first, then by name.
     *
     * @return list<array<string, mixed>>
     */
    public function members(Channel $channel, int $perPage, int $page): array
    {
        $rows = ChannelMember::query()
            ->where('channel_members.channel_id', $channel->id)
            ->join('users', 'users.id', '=', 'channel_members.user_id')
            ->leftJoin('positions', 'positions.id', '=', 'users.position_id')
            ->orderByRaw("case channel_members.role when 'owner' then 0 when 'admin' then 1 else 2 end")
            ->orderBy('users.name')
            ->orderBy('users.id')
            ->forPage($page, $perPage)
            ->get(['channel_members.user_id', 'channel_members.role', 'channel_members.joined_at', 'users.name', 'users.avatar_url', 'positions.name as position_name']);

        return array_values($rows->map(fn (ChannelMember $member): array => [
            'user_id' => $member->user_id,
            'name' => $member->getAttribute('name'),
            'initials' => self::initials($member->getAttribute('name')),
            'avatar' => $member->getAttribute('avatar_url'),
            'title' => $member->getAttribute('position_name') ?? '',
            'role' => $member->role->value,
            'role_label' => $member->role->label(),
            'joined_at' => $member->joined_at?->toIso8601String(),
        ])->all());
    }

    public static function initials(?string $name): string
    {
        $words = preg_split('/\s+/u', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if ($words === []) {
            return '?';
        }

        $first = mb_strtoupper(mb_substr($words[0], 0, 1));
        $second = count($words) > 1 ? mb_strtoupper(mb_substr($words[count($words) - 1], 0, 1)) : '';

        return $first.$second;
    }

    /**
     * "#nama" for named channels, the other person for a DM, "Sari, Maya +1"
     * for a group (same rule as ChannelTitle, without a query per channel).
     *
     * @param  list<string>  $others  names of the other members (direct only)
     */
    private function title(string $type, ?string $name, array $others): string
    {
        if ($type === ChannelType::Dm->value) {
            return $others[0] ?? 'Pesan langsung';
        }

        if ($type === ChannelType::Group->value) {
            $first = array_map(fn (string $full): string => explode(' ', $full)[0], $others);

            return implode(', ', array_slice($first, 0, 3)).(count($first) > 3 ? ' +'.(count($first) - 3) : '');
        }

        return '#'.$name;
    }

    /**
     * Names of the members other than the viewer, sorted by name.
     *
     * @param  list<string>  $memberIds
     * @param  array<string, string>  $names
     * @return list<string>
     */
    private function memberNames(array $memberIds, array $names, string $viewerId): array
    {
        $others = array_values(array_filter(
            array_map(fn (string $id): ?string => $id === $viewerId ? null : ($names[$id] ?? null), $memberIds),
        ));
        sort($others);

        return $others;
    }

    /**
     * @param  list<string>  $messageIds
     * @return array<string, list<string>> message id => mentioned user ids
     */
    private function mentions(array $messageIds): array
    {
        $rows = DB::table('mentions')
            ->where('mentionable_type', (new Message)->getMorphClass())
            ->whereIn('mentionable_id', $messageIds)
            ->orderBy('id')
            ->get(['mentionable_id', 'mentioned_user_id']);

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(string) $row->mentionable_id][] = (string) $row->mentioned_user_id;
        }

        return $grouped;
    }

    /**
     * @param  list<string>  $rootIds
     * @return array<string, array{reply_count: int, last_reply_at: string|null, participant_ids: list<string>}>
     */
    private function threads(array $rootIds): array
    {
        if ($rootIds === []) {
            return [];
        }

        // Deleted replies are not counted (the root keeps the live conversation size).
        $threads = [];

        $totals = Message::query()
            ->whereIn('parent_id', $rootIds)
            ->groupBy('parent_id')
            ->selectRaw('parent_id, count(*) as replies, max(created_at) as last_at')
            ->get();

        foreach ($totals as $total) {
            $threads[(string) $total->parent_id] = [
                'reply_count' => (int) $total->getAttribute('replies'),
                'last_reply_at' => Carbon::parse((string) $total->getAttribute('last_at'))->toIso8601String(),
                'participant_ids' => [],
            ];
        }

        $people = Message::query()
            ->whereIn('parent_id', $rootIds)
            ->whereNotNull('user_id')
            ->groupBy('parent_id', 'user_id')
            ->selectRaw('parent_id, user_id, min(id) as first_id')
            ->orderBy('first_id')
            ->get();

        foreach ($people as $person) {
            $parent = (string) $person->parent_id;

            if (isset($threads[$parent]) && count($threads[$parent]['participant_ids']) < self::PARTICIPANTS) {
                $threads[$parent]['participant_ids'][] = (string) $person->user_id;
            }
        }

        return $threads;
    }
}
