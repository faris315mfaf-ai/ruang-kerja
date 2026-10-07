<?php

namespace App\Domain\Announcements\Actions;

use App\Domain\Organization\Services\AuditLogger;
use App\Models\Announcement;
use App\Models\User;

/**
 * Soft-deletes an announcement (author only, checked by the policy): it
 * disappears from every dashboard; Inbox notifications already delivered
 * stay, queued ones are dropped (AnnouncementPublished::stillVisibleTo).
 */
final class DeleteAnnouncement
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(User $actor, Announcement $announcement): void
    {
        $announcement->delete();
        $this->audit->log('announcement.deleted', $announcement, ['title' => $announcement->title], null, $actor);
    }
}
