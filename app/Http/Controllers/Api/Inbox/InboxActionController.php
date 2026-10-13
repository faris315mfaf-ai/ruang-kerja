<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Domain\Notifications\Actions\ArchiveNotification;
use App\Domain\Notifications\Actions\MarkAllNotificationsRead;
use App\Domain\Notifications\Actions\MarkNotificationRead;
use App\Domain\Notifications\Actions\MarkNotificationUnread;
use App\Domain\Notifications\Actions\UnarchiveNotification;
use App\Domain\Notifications\Services\InboxQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\InboxBulkRequest;
use App\Http\Requests\Api\InboxIndexApiRequest;
use App\Http\Resources\Api\InboxItemResource;
use App\Models\InboxNotification;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Inbox mutations of the mobile app, one thin method per web
 * InboxNotificationController action (same Actions, same
 * InboxNotificationPolicy::update). Every answer carries the fresh counters so
 * the app can update the bell and the tab badges without another request.
 */
class InboxActionController extends Controller
{
    public function __construct(private readonly InboxQuery $inbox) {}

    public function unread(Request $request, #[CurrentUser] User $user, string $notification, MarkNotificationUnread $action): JsonResponse
    {
        $row = $this->owned($user, $notification);

        $action->handle($row);

        return $this->respond($request, $user, $row);
    }

    public function archive(Request $request, #[CurrentUser] User $user, string $notification, ArchiveNotification $action): JsonResponse
    {
        $row = $this->owned($user, $notification);

        $action->handle($row);

        return $this->respond($request, $user, $row);
    }

    public function unarchive(Request $request, #[CurrentUser] User $user, string $notification, UnarchiveNotification $action): JsonResponse
    {
        $row = $this->owned($user, $notification);

        $action->handle($row);

        return $this->respond($request, $user, $row);
    }

    /**
     * "Tandai semua dibaca". Without query values it is the web action (every
     * unread, non-archived notification); with tab/jenis it only touches what
     * that tab/chip lists. It never resolves "Perlu tindakan" items.
     */
    public function readAll(InboxIndexApiRequest $request, #[CurrentUser] User $user, MarkAllNotificationsRead $action): JsonResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        $scoped = $request->filled('tab') || $request->filled('jenis');
        $marked = $action->handle($user, $scoped ? $request->filters() : null);

        return response()->json([
            'marked' => $marked,
            'unread' => $this->inbox->unreadCount($user),
            'counts' => $this->inbox->tabCounts($user),
        ]);
    }

    /**
     * Same action on several selected notifications. Ids that are not the
     * caller's (or do not exist) are skipped and listed, never an error that
     * would undo the rest.
     */
    public function bulk(InboxBulkRequest $request, #[CurrentUser] User $user, MarkNotificationRead $read, MarkNotificationUnread $unread, ArchiveNotification $archive): JsonResponse
    {
        Gate::authorize('viewAny', InboxNotification::class);

        $rows = InboxNotification::query()->visibleTo($user)->whereIn('id', $request->ids())->get();

        DB::transaction(function () use ($request, $rows, $read, $unread, $archive): void {
            foreach ($rows as $row) {
                if (! Gate::allows('update', $row)) {
                    continue;
                }

                match ($request->action()) {
                    'baca' => $read->handle($row),
                    'belum-baca' => $unread->handle($row),
                    default => $archive->handle($row),
                };
            }
        });

        return response()->json([
            'affected' => $rows->count(),
            'skipped' => array_values(array_diff($request->ids(), $rows->pluck('id')->all())),
            'unread' => $this->inbox->unreadCount($user),
            'counts' => $this->inbox->tabCounts($user),
        ]);
    }

    private function owned(User $user, string $notification): InboxNotification
    {
        Gate::authorize('viewAny', InboxNotification::class);

        $row = InboxNotification::query()->visibleTo($user)->findOrFail($notification);

        Gate::authorize('update', $row);

        return $row;
    }

    private function respond(Request $request, User $user, InboxNotification $row): JsonResponse
    {
        return response()->json([
            'item' => (new InboxItemResource($row->refresh()))->resolve($request),
            'unread' => $this->inbox->unreadCount($user),
            'counts' => $this->inbox->tabCounts($user),
        ]);
    }
}
