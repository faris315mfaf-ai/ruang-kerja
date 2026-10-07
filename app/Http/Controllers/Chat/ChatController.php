<?php

namespace App\Http\Controllers\Chat;

use App\Domain\Chat\Actions\MarkChannelRead;
use App\Domain\Chat\Queries\ChannelTimeline;
use App\Domain\Chat\Queries\ChatInbox;
use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\User;
use App\Policies\ChannelPolicy;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /obrolan (F2-1): sidebar of channels and, on /obrolan/{channel}, the open
 * conversation (newest page; older pages and mutations are JSON endpoints).
 * Opening a channel marks it as read.
 */
class ChatController extends Controller
{
    public function index(#[CurrentUser] User $user, ChatInbox $inbox): Response
    {
        Gate::authorize('viewAny', Channel::class);

        return Inertia::render('chat/index', [
            'chat' => [
                'viewer_id' => $user->id,
                'people' => $inbox->people($user),
                'channels' => $inbox->channels($user),
                'current' => null,
            ],
        ]);
    }

    public function show(
        Channel $channel,
        #[CurrentUser] User $user,
        ChatInbox $inbox,
        ChannelTimeline $timeline,
        MarkChannelRead $markRead,
        ChannelPolicy $policy,
    ): Response {
        Gate::authorize('view', $channel);

        $markRead->handle($channel, $user);
        $page = $timeline->page($channel, $user);

        return Inertia::render('chat/show', [
            'chat' => [
                'viewer_id' => $user->id,
                'people' => $inbox->people($user),
                'channels' => $inbox->channels($user, including: $channel),
                'current' => [
                    'channel_id' => $channel->id,
                    'messages' => $page['messages'],
                    'tasks' => $page['tasks'],
                    'has_more' => $page['has_more'],
                    'can_post' => $policy->canPost($user, $channel),
                    'can_manage' => $policy->canManage($user, $channel),
                ],
            ],
        ]);
    }
}
