<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Queries\ChatInbox;
use App\Http\Controllers\Controller;
use App\Http\Resources\Chat\ApiChatPresenter;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * GET /api/v1/obrolan/kanal (alias GET /api/v1/obrolan) — the channel sidebar
 * of the mobile app: the same ChatInbox query as the web (the caller's
 * channels plus every public one, unread count, newest message preview,
 * members' read pointers and can_post/can_manage) plus the display `title`,
 * `is_member`, `members_count`, DM/group member names and the unread totals
 * for the tab badge. Realtime stays on Reverb for the web app; the mobile app
 * polls this list and the timeline.
 */
class ChannelController extends Controller
{
    public function __invoke(#[CurrentUser] User $user, ChatInbox $inbox, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('viewAny', Channel::class);

        $channels = $presenter->channels($inbox->channels($user), $user);

        return response()->json([
            'channels' => $channels,
            // Messages not read yet in the channels the user belongs to (the app's badge shows channels, like the web's chatUnread).
            'unread_total' => array_sum(array_map(
                fn (array $channel): int => $channel['is_member'] ? (int) $channel['unread_count'] : 0,
                $channels,
            )),
            'unread_channels' => $inbox->unreadChannels($user),
        ]);
    }
}
