<?php

namespace App\Http\Controllers\Chat;

use App\Domain\Chat\Actions\DeleteMessage;
use App\Domain\Chat\Actions\EditMessage;
use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Chat\Actions\ToggleMessageReaction;
use App\Domain\Chat\Queries\ChannelTimeline;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\MessageRequest;
use App\Http\Requests\Chat\ReactRequest;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * JSON endpoints of a conversation. Each mutation answers with the fresh
 * message (+ referenced tasks) so the client replaces its optimistic copy.
 */
class MessageController extends Controller
{
    /** Older page: GET /obrolan/{channel}/pesan?sebelum={id}. */
    public function index(Request $request, Channel $channel, #[CurrentUser] User $user, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('view', $channel);

        $before = $request->query('sebelum');

        return response()->json($timeline->page($channel, $user, is_string($before) && $before !== '' ? $before : null));
    }

    /** Realtime refetch of one message (also a deleted one). */
    public function show(Message $message, #[CurrentUser] User $user, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('view', $message);

        return response()->json($timeline->one($message, $user));
    }

    public function store(MessageRequest $request, Channel $channel, #[CurrentUser] User $user, PostMessage $post, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('create', [Message::class, $channel]);

        $parentId = $request->input('parent_id');
        $parent = is_string($parentId) ? Message::withTrashed()->where('channel_id', $channel->id)->find($parentId) : null;

        if (is_string($parentId) && $parent === null) {
            abort(422, 'Pesan utama tidak ditemukan.');
        }

        /** @var array<mixed>|null $body */
        $body = $request->input('body');
        /** @var list<string> $attachments */
        $attachments = array_values($request->array('attachments'));

        $message = $post->handle($channel, $user, $body, $attachments, $parent);

        return response()->json($timeline->one($message->fresh() ?? $message, $user), 201);
    }

    public function update(MessageRequest $request, Message $message, #[CurrentUser] User $user, EditMessage $edit, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('update', $message);

        /** @var array<mixed>|null $body */
        $body = $request->input('body');
        $edit->handle($message, $user, $body);

        return response()->json($timeline->one($message->refresh(), $user));
    }

    public function destroy(Message $message, #[CurrentUser] User $user, DeleteMessage $delete, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('delete', $message);

        $delete->handle($message, $user);

        return response()->json($timeline->one(Message::withTrashed()->findOrFail($message->id), $user));
    }

    public function react(ReactRequest $request, Message $message, #[CurrentUser] User $user, ToggleMessageReaction $toggle, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('react', $message);

        $toggle->handle($message, $user, $request->string('emoji')->toString());

        return response()->json($timeline->one($message, $user));
    }
}
