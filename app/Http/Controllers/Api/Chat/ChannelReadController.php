<?php

namespace App\Http\Controllers\Api\Chat;

use App\Domain\Chat\Actions\MarkChannelRead;
use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * POST /api/v1/obrolan/kanal/{channel}/dibaca — the app's way to clear the
 * unread badge without the web: the same web action (pointer + notification
 * cleanup + Reverb broadcast for the web users).
 */
class ChannelReadController extends Controller
{
    public function __invoke(Channel $channel, #[CurrentUser] User $user, MarkChannelRead $mark): JsonResponse
    {
        Gate::authorize('view', $channel);

        $mark->handle($channel, $user);

        return response()->json(['dibaca' => true]);
    }
}
