<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\PostMessage;
use App\Domain\Chat\Queries\ChannelTimeline;
use App\Domain\Tasks\Services\RichText;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ChatMessageRequest;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Messages of one channel for the mobile app. GET answers the web timeline
 * page (messages oldest-first inside the page, referenced tasks, has_more)
 * 30 at a time — `?sebelum={message id}` pages back like the web. POST runs
 * the web PostMessage behind ChannelPolicy::post: the app sends plain text,
 * which becomes the same minimal Tiptap document the web stores, so the
 * Reverb broadcast (MessagePosted) still fires for the web users while the
 * app itself polls.
 */
class MessageController extends Controller
{
    public const int PAGE = 30;

    public function index(Request $request, Channel $channel, #[CurrentUser] User $user, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('view', $channel);

        $before = $request->query('sebelum');

        return response()->json(
            $timeline->page($channel, $user, is_string($before) && $before !== '' ? $before : null, self::PAGE),
        );
    }

    public function store(ChatMessageRequest $request, Channel $channel, #[CurrentUser] User $user, PostMessage $post, ChannelTimeline $timeline): JsonResponse
    {
        Gate::authorize('create', [Message::class, $channel]);

        $message = $post->handle($channel, $user, RichText::fromText($request->string('body')->toString()));

        return response()->json($timeline->one($message->fresh() ?? $message, $user), 201);
    }
}
