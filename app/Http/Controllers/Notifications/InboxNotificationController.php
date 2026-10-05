<?php

namespace App\Http\Controllers\Notifications;

use App\Domain\Notifications\Actions\ArchiveNotification;
use App\Domain\Notifications\Actions\MarkAllNotificationsRead;
use App\Domain\Notifications\Actions\MarkNotificationRead;
use App\Domain\Notifications\Actions\MarkNotificationUnread;
use App\Domain\Notifications\Actions\UnarchiveNotification;
use App\Domain\Notifications\Data\NotificationPayload;
use App\Domain\Notifications\Services\InboxQuery;
use App\Http\Controllers\Controller;
use App\Models\InboxNotification;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Inbox mutations. JSON callers get {unread}; Inertia visits are redirected back.
 */
class InboxNotificationController extends Controller
{
    /**
     * Open from the toast/email/list: mark read, then go to the target page.
     */
    public function open(InboxNotification $notification, MarkNotificationRead $markRead): RedirectResponse
    {
        Gate::authorize('view', $notification);

        $markRead->handle($notification);

        $url = $notification->dataString('url');

        return redirect()->to($url !== null && NotificationPayload::isInternalUrl($url) ? $url : '/inbox');
    }

    public function read(Request $request, #[CurrentUser] User $user, InboxNotification $notification, MarkNotificationRead $markRead, InboxQuery $inbox): JsonResponse|RedirectResponse
    {
        Gate::authorize('update', $notification);

        $markRead->handle($notification);

        return $this->respond($request, $user, $inbox);
    }

    public function unread(Request $request, #[CurrentUser] User $user, InboxNotification $notification, MarkNotificationUnread $markUnread, InboxQuery $inbox): JsonResponse|RedirectResponse
    {
        Gate::authorize('update', $notification);

        $markUnread->handle($notification);

        return $this->respond($request, $user, $inbox);
    }

    public function archive(Request $request, #[CurrentUser] User $user, InboxNotification $notification, ArchiveNotification $archive, InboxQuery $inbox): JsonResponse|RedirectResponse
    {
        Gate::authorize('update', $notification);

        $archive->handle($notification);

        return $this->respond($request, $user, $inbox);
    }

    public function unarchive(Request $request, #[CurrentUser] User $user, InboxNotification $notification, UnarchiveNotification $unarchive, InboxQuery $inbox): JsonResponse|RedirectResponse
    {
        Gate::authorize('update', $notification);

        $unarchive->handle($notification);

        return $this->respond($request, $user, $inbox);
    }

    public function readAll(Request $request, #[CurrentUser] User $user, MarkAllNotificationsRead $markAllRead, InboxQuery $inbox): JsonResponse|RedirectResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        $count = $markAllRead->handle($user);

        if ($request->expectsJson()) {
            return response()->json(['unread' => $inbox->unreadCount($user), 'marked' => $count]);
        }

        return back()->with('toast', [
            'type' => 'success',
            'message' => $count > 0 ? "{$count} notifikasi ditandai dibaca." : 'Tidak ada notifikasi belum dibaca.',
        ]);
    }

    private function respond(Request $request, User $user, InboxQuery $inbox): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['unread' => $inbox->unreadCount($user)]);
        }

        return back();
    }
}
