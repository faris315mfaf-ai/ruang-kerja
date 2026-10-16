<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\ToggleMessageReaction;
use App\Domain\Chat\Queries\ChannelTimeline;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\ReactRequest;
use App\Http\Resources\Chat\ApiChatPresenter;
use App\Models\Channel;
use App\Models\Message;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Emoji reactions of the fixed web set (Reaction::EMOJI). The web action is a
 * toggle; the API exposes it as two idempotent calls (add / remove) so a
 * retried request from a flaky connection never flips the state back.
 */
class ReactionController extends Controller
{
    public function store(ReactRequest $request, Channel $channel, Message $message, #[CurrentUser] User $user, ToggleMessageReaction $toggle, ChannelTimeline $timeline, ApiChatPresenter $presenter): JsonResponse
    {
        return $this->set($request, $channel, $message, $user, true, $toggle, $timeline, $presenter);
    }

    public function destroy(ReactRequest $request, Channel $channel, Message $message, #[CurrentUser] User $user, ToggleMessageReaction $toggle, ChannelTimeline $timeline, ApiChatPresenter $presenter): JsonResponse
    {
        return $this->set($request, $channel, $message, $user, false, $toggle, $timeline, $presenter);
    }

    private function set(ReactRequest $request, Channel $channel, Message $message, User $user, bool $wanted, ToggleMessageReaction $toggle, ChannelTimeline $timeline, ApiChatPresenter $presenter): JsonResponse
    {
        Gate::authorize('react', $message);

        $emoji = $request->string('emoji')->toString();
        $exists = $message->reactions()->where('user_id', $user->id)->where('emoji', $emoji)->exists();

        if ($exists !== $wanted) {
            $toggle->handle($message, $user, $emoji);
        }

        return response()->json([
            'reacted' => $wanted,
            ...MessageController::one($timeline->one($message->refresh(), $user), $channel, $user, $presenter),
        ]);
    }
}
