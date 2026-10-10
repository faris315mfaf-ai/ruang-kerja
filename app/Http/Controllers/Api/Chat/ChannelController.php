<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Queries\ChatInbox;
use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/obrolan/kanal — the channel sidebar of the mobile app: the
 * same ChatInbox query as the web (the caller's channels plus every public
 * one, unread count, newest message preview, members' read pointers and
 * can_post/can_manage). Realtime stays on Reverb for the web app; the mobile
 * app polls this list and the timeline.
 */
class ChannelController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, ChatInbox $inbox): JsonResponse
    {
        Gate::authorize('viewAny', Channel::class);

        return response()->json(['channels' => $inbox->channels($user)]);
    }
}
