<?php

namespace App\Http\Controllers\Notifications;

use App\Domain\Notifications\Services\InboxQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Notifications\NotificationFeedRequest;
use App\Http\Resources\InboxNotificationResource;
use App\Models\InboxNotification;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Polling fallback when the WebSocket is unavailable (every 30 s):
 * unread counter + notifications created after the client's cursor.
 */
class NotificationFeedController extends Controller
{
    public function __invoke(NotificationFeedRequest $request, #[CurrentUser] User $user, InboxQuery $inbox): JsonResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        return response()->json([
            'unread' => $inbox->unreadCount($user),
            'notifications' => InboxNotificationResource::collection($inbox->since($user, $request->cursor()))->resolve($request),
            'server_time' => CarbonImmutable::now()->toIso8601String(),
        ]);
    }
}
