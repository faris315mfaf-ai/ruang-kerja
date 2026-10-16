<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Domain\Notifications\Actions\MarkNotificationRead;
use App\Domain\Notifications\Services\InboxQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\InboxIndexApiRequest;
use App\Http\Resources\Api\InboxItemResource;
use App\Models\InboxNotification;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Inbox of the mobile app: the caller's own notifications, filtered by the
 * same InboxQuery / scopes as the web Inbox and presented by the web
 * InboxNotificationResource (+ `target` and `android_channel`). Another
 * person's notification never resolves (404) — not even for Super Admin.
 * Mutations live in InboxActionController.
 */
class InboxController extends Controller
{
    public function index(InboxIndexApiRequest $request, #[CurrentUser] User $user, InboxQuery $inbox): JsonResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        /** @var LengthAwarePaginator<int, InboxNotification> $notifications */
        $notifications = $inbox->filtered($user, $request->filters())
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($request->perPage());

        $counts = $inbox->tabCounts($user);

        return response()->json([
            'items' => InboxItemResource::collection($notifications->items())->resolve($request),
            'unread' => $counts['belum_dibaca'],
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'from' => $notifications->firstItem(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'to' => $notifications->lastItem(),
                'total' => $notifications->total(),
                'counts' => $counts,
            ],
        ]);
    }

    /** One notification in full (briefing "Informatif", items without a target). */
    public function show(Request $request, #[CurrentUser] User $user, string $notification, InboxQuery $inbox): JsonResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        $row = InboxNotification::query()->visibleTo($user)->findOrFail($notification);

        Gate::authorize('view', $row);

        return response()->json([
            'item' => (new InboxItemResource($row))->resolve($request),
            'unread' => $inbox->unreadCount($user),
        ]);
    }

    public function read(#[CurrentUser] User $user, string $notification, MarkNotificationRead $markRead, InboxQuery $inbox): JsonResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        $row = InboxNotification::query()->visibleTo($user)->findOrFail($notification);

        Gate::authorize('update', $row);

        $markRead->handle($row);

        // Same body as the web JSON endpoint (InboxNotificationController::read).
        return response()->json(['unread' => $inbox->unreadCount($user)]);
    }
}
