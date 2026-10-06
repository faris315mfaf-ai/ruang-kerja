<?php

namespace App\Http\Controllers\Announcements;

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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Pengumuman (keputusan pemilik 6 Okt 2026): /pengumuman (received + mine,
 * create, delete own), the dashboard banner (JSON, loaded apart from the
 * dashboards) and closing a banner.
 */
class AnnouncementController extends Controller
{
    public function __construct(private readonly AnnouncementFeed $feed) {}

    public function index(Request $request, #[CurrentUser] User $user, AnnouncementTargets $targets): Response
    {
        Gate::authorize('viewAny', Announcement::class);

        $canCreate = Gate::allows('create', Announcement::class);
        $options = $canCreate ? $targets->optionsFor($user) : null;
        $selected = $request->query('pilih');

        return Inertia::render('announcements/index', [
            'received' => $this->feed->received($user),
            'mine' => $this->feed->authored($user),
            'selected' => is_string($selected) ? $selected : null,
            'can_create' => $canCreate,
            'options' => $options === null ? null : [
                'audiences' => array_map(fn (AnnouncementAudience $audience): array => ['value' => $audience->value, 'label' => $audience->label()], $options['audiences']),
                'divisions' => $options['divisions'],
                'teams' => $options['teams'],
            ],
        ]);
    }

    public function store(StoreAnnouncementRequest $form, #[CurrentUser] User $user, PublishAnnouncement $publish): RedirectResponse
    {
        Gate::authorize('create', Announcement::class);

        $publish->handle($user, $form->string('title')->toString(), $form->string('body')->toString(), $form->audience(), $form->targetIds(), $form->expiresAt());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengumuman diterbitkan.']);

        return to_route('announcements.index');
    }

    public function destroy(#[CurrentUser] User $user, Announcement $announcement, DeleteAnnouncement $delete): RedirectResponse
    {
        Gate::authorize('delete', $announcement);

        $delete->handle($user, $announcement);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Pengumuman dihapus.']);

        return to_route('announcements.index');
    }

    /**
     * Dashboard banner: latest 3 active announcements not closed by me.
     */
    public function banner(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('viewAny', Announcement::class);

        return response()->json($this->feed->banner($user));
    }

    public function dismiss(#[CurrentUser] User $user, Announcement $announcement, DismissAnnouncement $dismiss): HttpResponse
    {
        Gate::authorize('dismiss', $announcement);

        $dismiss->handle($user, $announcement);

        return response()->noContent();
    }
}
