<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Domain\Notifications\Actions\MarkNotificationRead;
use App\Domain\Notifications\Services\InboxQuery;
use App\Http\Controllers\Controller;
use App\Http\Resources\InboxNotificationResource;
use App\Models\InboxNotification;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Inbox feed of the mobile app (Tahap 1): the caller's own active
 * notifications, presented by the web InboxNotificationResource (judul, isi,
 * tipe, url, dibaca_pada, waktu). "baca" marks one notification read through
 * the web action; a notification of someone else resolves to 404 via the
 * same visibleTo scope the web Inbox uses (not even Super Admin sees others).
 */
class InboxController extends Controller
{
    public function index(Request $request, #[CurrentUser] User $user, InboxQuery $inbox): JsonResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        /** @var LengthAwarePaginator<int, InboxNotification> $notifications */
        $notifications = InboxNotification::query()
            ->visibleTo($user)
            ->active()
            ->when($request->boolean('belum-dibaca'), fn ($query) => $query->whereNull('read_at'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json([
            'items' => InboxNotificationResource::collection($notifications->items())->resolve($request),
            'unread' => $inbox->unreadCount($user),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'from' => $notifications->firstItem(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'to' => $notifications->lastItem(),
                'total' => $notifications->total(),
            ],
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
