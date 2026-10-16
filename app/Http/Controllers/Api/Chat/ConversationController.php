<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\CreateChannel;
use App\Domain\Chat\Actions\JoinChannel;
use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Actions\SetChannelMuted;
use App\Domain\Chat\Queries\AttachableDriveFiles;
use App\Domain\Chat\Queries\PublicChannelDirectory;
use App\Domain\Chat\Queries\TaskReferenceSuggestions;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ChatActionRequest;
use App\Http\Requests\Api\ChatConversationRequest;
use App\Http\Requests\Api\ChatPageRequest;
use App\Http\Requests\Chat\MuteRequest;
use App\Http\Resources\Chat\ApiChatPresenter;
use App\Models\Channel;
use App\Models\ChannelMember;
use App\Models\DriveFile;
use App\Models\Message;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Conversations for the mobile app beyond the timeline: create a DM/group or
 * a channel, browse and join public channels, mute, the detail screen with
 * its members, read receipts, and the composer pickers (Drive files, #tasks).
 * Every call goes through the same Actions and ChannelPolicy as the web.
 */
class ConversationController extends Controller
{
    /** POST /obrolan — `jenis: langsung` opens a DM/group, `jenis: kanal` creates a channel. */
    public function store(ChatConversationRequest $request, #[CurrentUser] User $user, OpenDirectConversation $open, CreateChannel $create, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('create', Channel::class);

        if ($request->input('jenis') === 'langsung') {
            /** @var list<string> $userIds */
            $userIds = array_values($request->array('user_ids'));
            $channel = $open->handle($user, $userIds);
        } else {
            /** @var list<string> $memberIds */
            $memberIds = array_values($request->array('member_ids'));
            $channel = $create->handle($user, [
                'name' => $request->string('name')->toString(),
                'topic' => $request->input('topic'),
                'private' => $request->boolean('private'),
                'member_ids' => $memberIds,
            ]);
        }

        return response()->json([
            'id' => $channel->id,
            'created' => $channel->wasRecentlyCreated,
            'channel' => $presenter->detail($channel, $user),
        ], $channel->wasRecentlyCreated ? 201 : 200);
    }

    /** GET /obrolan/{channel} — detail screen. */
    public function show(ChatActionRequest $request, Channel $channel, #[CurrentUser] User $user, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('view', $channel);

        return response()->json(['channel' => $presenter->detail($channel, $user)]);
    }

    /** GET /obrolan/{channel}/anggota?page=&per_page= */
    public function members(ChatPageRequest $request, Channel $channel, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('view', $channel);

        $page = $request->integer('page', 1);
        $perPage = $request->integer('per_page', 50);
        $total = $channel->memberships()->count();

        return response()->json([
            'members' => $presenter->members($channel, $perPage, $page),
            'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total, 'has_more' => $page * $perPage < $total],
        ]);
    }

    /** GET /obrolan/kanal-publik?q=&page=&per_page= */
    public function publicChannels(ChatPageRequest $request, #[CurrentUser] User $user, PublicChannelDirectory $directory): JsonResponse
    {
        Gate::authorize('viewAny', Channel::class);

        $page = $request->integer('page', 1);
        $perPage = $request->integer('per_page', 30);
        $found = $directory->handle($user, $request->query('q') === null ? null : $request->string('q')->toString(), $page, $perPage);

        return response()->json([
            'channels' => $found['channels'],
            'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $found['total'], 'has_more' => $page * $perPage < $found['total']],
        ]);
    }

    /** POST /obrolan/{channel}/gabung — join a public channel (idempotent). */
    public function join(ChatActionRequest $request, Channel $channel, #[CurrentUser] User $user, JoinChannel $join, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('view', $channel);

        $joined = $join->handle($channel, $user);

        return response()->json(['joined' => $joined, 'channel' => $presenter->detail($channel, $user)], $joined ? 201 : 200);
    }

    /** PATCH /obrolan/{channel}/bisu {muted} */
    public function mute(MuteRequest $request, Channel $channel, #[CurrentUser] User $user, SetChannelMuted $mute): JsonResponse
    {
        Gate::authorize('participate', $channel);

        $mute->handle($channel, $user, $request->boolean('muted'));

        return response()->json(['muted' => $request->boolean('muted')]);
    }

    /** GET /obrolan/{channel}/dibaca-oleh/{message} — who has read up to this message (members only, names only). */
    public function readBy(ChatActionRequest $request, Channel $channel, string $message, #[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', $channel);

        $target = Message::withTrashed()->where('channel_id', $channel->id)->findOrFail($message);

        abort_unless($channel->hasMember($user), 403, 'Hanya anggota obrolan yang dapat melihat siapa yang sudah membaca.');

        $recipients = ChannelMember::query()
            ->where('channel_members.channel_id', $channel->id)
            ->when($target->user_id !== null, fn ($query) => $query->where('channel_members.user_id', '!=', $target->user_id));

        $readers = (clone $recipients)
            ->where('channel_members.last_read_message_id', '>=', $target->id)
            ->join('users', 'users.id', '=', 'channel_members.user_id')
            ->orderBy('users.name')
            ->orderBy('users.id')
            ->limit(100)
            ->get(['channel_members.user_id', 'users.name']);

        return response()->json([
            'message_id' => $target->id,
            'recipients_count' => $recipients->count(),
            'read_count' => $readers->count(),
            'readers' => array_values($readers->map(fn (ChannelMember $reader): array => [
                'id' => $reader->user_id,
                'name' => $reader->getAttribute('name'),
                'initials' => ApiChatPresenter::initials($reader->getAttribute('name')),
            ])->all()),
        ]);
    }

    /** GET /obrolan/{channel}/file-drive?q= — Drive files every reader of the channel can open (cache only, no Google call). */
    public function driveFiles(Request $request, Channel $channel, #[CurrentUser] User $user, AttachableDriveFiles $attachable): JsonResponse
    {
        Gate::authorize('post', $channel);

        $search = $request->query('q');
        $files = $attachable->query($channel, $user, is_string($search) ? $search : null)->limit(30)->get();

        return response()->json([
            'files' => array_values($files->map(fn (DriveFile $file): array => [
                'id' => $file->id,
                'name' => $file->name,
                'kind' => $file->kind->value,
                'web_view_link' => $file->web_view_link,
                'size_bytes' => $file->size_bytes,
                'owner_email' => $file->owner_email,
            ])->all()),
        ]);
    }

    /** GET /obrolan/rujukan/tugas?q= — #KEY-n suggestions of tasks the user can see. */
    public function taskReferences(Request $request, #[CurrentUser] User $user, TaskReferenceSuggestions $suggestions): JsonResponse
    {
        return response()->json(['tasks' => $suggestions->handle($user, trim((string) $request->query('q', '')))]);
    }
}
