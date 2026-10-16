<?php

namespace App\Http\Controllers\Api\Announcements;

use App\Domain\Announcements\Actions\DeleteAnnouncement;
use App\Domain\Announcements\Actions\DismissAnnouncement;
use App\Domain\Announcements\Actions\PublishAnnouncement;
use App\Domain\Announcements\Enums\AnnouncementAudience;
use App\Domain\Announcements\Queries\AnnouncementFeed;
use App\Domain\Announcements\Services\AnnouncementTargets;
use App\Http\Controllers\Controller;
use App\Http\Requests\Announcements\StoreAnnouncementRequest;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Gate;

/**
 * Pengumuman for the Android app (Bagian 2 / B2-B): the web feed
 * (AnnouncementFeed), Actions (Publish / Delete / Dismiss) and
 * AnnouncementPolicy — not addressed to me → 404, only the author deletes,
 * who may announce to whom is AnnouncementTargets. Lists are paginated
 * (20 per page) with the same `meta` block as GET /tugas.
 */
class AnnouncementController extends Controller
{
    public function __construct(private readonly AnnouncementFeed $feed) {}

    /**
     * `?tab=untuk-saya` (default; active announcements addressed to me,
     * closed banners included and marked `dismissed`) or `saya-buat` (the
     * ones I wrote, expired included).
     */
    public function index(Request $request, #[CurrentUser] User $user, AnnouncementTargets $targets): JsonResponse
    {
        Gate::authorize('viewAny', Announcement::class);

        $tab = $request->query('tab') === 'saya-buat' ? 'saya-buat' : 'untuk-saya';
        $page = $tab === 'saya-buat' ? $this->feed->authoredPage($user) : $this->feed->receivedPage($user);

        return response()->json([
            'tab' => $tab,
            'items' => $this->feed->present($page->getCollection(), $user),
            'meta' => self::meta($page),
            'can_create' => $targets->canAnnounce($user),
        ]);
    }

    /**
     * Dashboard banner: latest 3 active announcements not closed by me.
     */
    public function banner(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', Announcement::class);

        return response()->json($this->feed->banner($user));
    }

    /**
     * Which audiences the viewer may announce to (division and team lists
     * included); 403 for employees who cannot announce at all.
     */
    public function audiences(#[CurrentUser] User $user, AnnouncementTargets $targets): JsonResponse
    {
        Gate::authorize('create', Announcement::class);

        $options = $targets->optionsFor($user);

        return response()->json([
            'audiences' => array_map(fn (AnnouncementAudience $audience): array => ['value' => $audience->value, 'label' => $audience->label()], $options['audiences']),
            'divisions' => $options['divisions'],
            'teams' => $options['teams'],
        ]);
    }

    public function show(#[CurrentUser] User $user, Announcement $announcement): JsonResponse
    {
        Gate::authorize('view', $announcement);

        $announcement->load('author:id,name,avatar_url')
            ->loadExists(['dismissedBy as dismissed' => fn ($query) => $query->whereKey($user->id)]);

        return response()->json(['pengumuman' => $this->item($announcement, $user)]);
    }

    /**
     * Publish now; the recipients are notified by the queued
     * SendAnnouncementNotifications job. A target outside the viewer's rights
     * is a 422 on `target_ids`, a past `expires_on` a 422 on `expires_on`.
     */
    public function store(StoreAnnouncementRequest $form, #[CurrentUser] User $user, PublishAnnouncement $publish): JsonResponse
    {
        Gate::authorize('create', Announcement::class);

        $announcement = $publish->handle(
            $user,
            $form->string('title')->toString(),
            $form->string('body')->toString(),
            $form->audience(),
            $form->targetIds(),
            $form->expiresAt(),
        );

        return response()->json([
            'message' => 'Pengumuman diterbitkan.',
            'pengumuman' => $this->item($announcement->load('author:id,name,avatar_url'), $user),
        ], 201);
    }

    public function destroy(#[CurrentUser] User $user, Announcement $announcement, DeleteAnnouncement $delete): JsonResponse
    {
        Gate::authorize('delete', $announcement);

        $delete->handle($user, $announcement);

        return response()->json(status: 204);
    }

    /**
     * Close the banner on my own dashboards (idempotent; the Inbox
     * notification stays).
     */
    public function dismiss(#[CurrentUser] User $user, Announcement $announcement, DismissAnnouncement $dismiss): JsonResponse
    {
        Gate::authorize('dismiss', $announcement);

        $dismiss->handle($user, $announcement);

        return response()->json(status: 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function item(Announcement $announcement, User $viewer): array
    {
        return $this->feed->present(new Collection([$announcement]), $viewer)[0];
    }

    /**
     * @param  LengthAwarePaginator<int, Announcement>  $page
     * @return array<string, int|null>
     */
    private static function meta(LengthAwarePaginator $page): array
    {
        return [
            'current_page' => $page->currentPage(),
            'from' => $page->firstItem(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'to' => $page->lastItem(),
            'total' => $page->total(),
        ];
    }
}
