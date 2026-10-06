<?php

namespace App\Policies;

use App\Domain\Announcements\Services\AnnouncementTargets;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Pengumuman (keputusan pemilik 6 Okt 2026): everyone reads what is
 * addressed to them (and what they wrote); Direksi, HR, Super Admin, Kepala
 * Divisi and Ketua Tim write; only the author deletes. Otherwise 404.
 */
class AnnouncementPolicy
{
    public function __construct(private readonly AnnouncementTargets $targets) {}

    /**
     * Lists are always scoped (Announcement::receivedBy / author).
     */
    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Announcement $announcement): Response
    {
        if (! $user->isActive() || $announcement->company_id !== $user->company_id) {
            return Response::denyAsNotFound();
        }

        return $announcement->author_id === $user->id
            || Announcement::query()->whereKey($announcement->id)->receivedBy($user)->exists()
            ? Response::allow()
            : Response::denyAsNotFound();
    }

    public function create(User $user): bool
    {
        return $this->targets->canAnnounce($user);
    }

    /**
     * Close the banner on one's own dashboards (the Inbox notification stays).
     */
    public function dismiss(User $user, Announcement $announcement): Response
    {
        return $this->view($user, $announcement);
    }

    public function delete(User $user, Announcement $announcement): Response
    {
        if ($announcement->author_id === $user->id && $user->isActive()) {
            return Response::allow();
        }

        return $this->view($user, $announcement)->allowed()
            ? Response::deny('Hanya pembuat yang bisa menghapus pengumuman ini.')
            : Response::denyAsNotFound();
    }

    public function update(User $user, Announcement $announcement): bool
    {
        return false;
    }
}
