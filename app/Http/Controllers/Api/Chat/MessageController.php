<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\DeleteMessage;
use App\Domain\Chat\Actions\EditMessage;
use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Chat\Queries\ChannelTimeline;
use App\Domain\Chat\Queries\MessageSearch;
use App\Domain\Chat\Services\ComposeMessageDocument;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ChatActionRequest;
use App\Http\Requests\Api\ChatMessageRequest;
use App\Http\Requests\Api\ChatMessageUpdateRequest;
use App\Http\Requests\Api\ChatRepliesRequest;
use App\Http\Requests\Api\ChatSearchRequest;
use App\Http\Resources\Chat\ApiChatPresenter;
use App\Http\Resources\Chat\ChatPresenter;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Messages of one channel for the mobile app. GET answers the web timeline
 * page (messages oldest-first inside the page, referenced tasks, has_more)
 * 30 at a time — `?sebelum={message id}` pages back like the web. POST runs
 * the web PostMessage behind ChannelPolicy::post: the app sends plain text
 * (+ resolved mention/task/Drive ids, optional thread root), which becomes
 * the same Tiptap document the web stores, so the Reverb broadcast
 * (MessagePosted) still fires for the web users while the app itself polls.
 * Edit, delete, thread replies and in-channel search follow the same Actions
 * and Policies as the web. Every message row carries the ApiChatPresenter
 * extras (author, thread summary, reaction summary, mentions, `can`).
 */
class MessageController extends Controller
{
    public const int PAGE = 30;

    public function index(Request $request, Channel $channel, #[CurrentUser] User $user, ChannelTimeline $timeline, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('view', $channel);

        $before = $request->query('sebelum');

        $payload = $timeline->page($channel, $user, is_string($before) && $before !== '' ? $before : null, self::PAGE);
        $payload['messages'] = $presenter->messages($payload['messages'], $channel, $user);

        return response()->json($payload);
    }

    public function store(
        ChatMessageRequest $request,
        Channel $channel,
        #[CurrentUser] User $user,
        PostMessage $post,
        ChannelTimeline $timeline,
        ComposeMessageDocument $compose,
        ApiChatPresenter $presenter,
    ): JsonResponse {
        Gate::authorize('create', [Message::class, $channel]);

        $parentId = $request->input('parent_id');
        $parent = is_string($parentId) ? Message::withTrashed()->where('channel_id', $channel->id)->find($parentId) : null;

        if (is_string($parentId) && $parent === null) {
            throw ValidationException::withMessages(['parent_id' => 'Pesan utama tidak ditemukan.']);
        }

        $document = $compose->handle(
            $channel,
            $user,
            $request->input('body'),
            self::ids($request, 'mentions'),
            self::ids($request, 'task_refs'),
        );

        $message = $post->handle($channel, $user, $document, self::ids($request, 'attachments'), $parent);

        return response()->json(self::one($timeline->one($message->fresh() ?? $message, $user), $channel, $user, $presenter), 201);
    }

    /** One thread: the root and its replies, oldest first, `?setelah={reply id}&per_page=`. */
    public function replies(
        ChatRepliesRequest $request,
        Channel $channel,
        string $message,
        #[CurrentUser] User $user,
        ChannelTimeline $timeline,
        ApiChatPresenter $presenter,
    ): JsonResponse {
        Gate::authorize('view', $channel);

        $root = Message::withTrashed()
            ->where('channel_id', $channel->id)
            ->whereNull('parent_id')
            ->findOrFail($message);

        $after = $request->query('setelah');
        $payload = $timeline->replies(
            $root,
            $user,
            is_string($after) && $after !== '' ? $after : null,
            $request->integer('per_page', self::PAGE),
        );

        $rows = $presenter->messages([$payload['root'], ...$payload['replies']], $channel, $user);
        $last = $payload['replies'] === [] ? null : $payload['replies'][array_key_last($payload['replies'])]['id'];

        return response()->json([
            'root' => $rows[0],
            'replies' => array_slice($rows, 1),
            'tasks' => $payload['tasks'],
            'has_more' => $payload['has_more'],
            'next_cursor' => $payload['has_more'] ? $last : null,
        ]);
    }

    public function update(
        ChatMessageUpdateRequest $request,
        Channel $channel,
        Message $message,
        #[CurrentUser] User $user,
        EditMessage $edit,
        ChannelTimeline $timeline,
        ComposeMessageDocument $compose,
        ApiChatPresenter $presenter,
    ): JsonResponse {
        Gate::authorize('update', $message);

        $document = $compose->handle(
            $channel,
            $user,
            $request->input('body'),
            self::ids($request, 'mentions'),
            self::ids($request, 'task_refs'),
        );

        $edit->handle($message, $user, $document);

        return response()->json(self::one($timeline->one($message->refresh(), $user), $channel, $user, $presenter));
    }

    public function destroy(
        ChatActionRequest $request,
        Channel $channel,
        Message $message,
        #[CurrentUser] User $user,
        DeleteMessage $delete,
        ChannelTimeline $timeline,
        ApiChatPresenter $presenter,
    ): JsonResponse {
        Gate::authorize('delete', $message);

        $delete->handle($message, $user);

        return response()->json(self::one($timeline->one(Message::withTrashed()->findOrFail($message->id), $user), $channel, $user, $presenter));
    }

    /** In-channel search: newest first, `?q=&sebelum=`. */
    public function search(ChatSearchRequest $request, Channel $channel, #[CurrentUser] User $user, MessageSearch $search, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('view', $channel);

        $before = $request->query('sebelum');
        $found = $search->handle($channel, $request->string('q')->toString(), is_string($before) && $before !== '' ? $before : null);

        $messages = array_values($found['messages']->load(['reactions', 'attachments.driveFile'])
            ->map(fn (Message $message): array => ChatPresenter::message($message))->all());

        $rows = $presenter->messages($messages, $channel, $user);

        return response()->json([
            'query' => $request->string('q')->toString(),
            'messages' => $rows,
            'has_more' => $found['has_more'],
            'next_cursor' => $found['has_more'] && $rows !== [] ? $rows[array_key_last($rows)]['id'] : null,
        ]);
    }

    /**
     * @param  array{message: array<string, mixed>, tasks: list<array<string, mixed>>}  $payload
     * @return array{message: array<string, mixed>, tasks: list<array<string, mixed>>}
     */
    public static function one(array $payload, Channel $channel, User $user, ApiChatPresenter $presenter): array
    {
        $payload['message'] = $presenter->messages([$payload['message']], $channel, $user)[0];

        return $payload;
    }

    /**
     * @return list<string>
     */
    private static function ids(Request $request, string $key): array
    {
        /** @var list<string> */
        return array_values(array_map('strval', $request->array($key)));
    }
}
