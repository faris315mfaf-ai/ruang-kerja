<?php

namespace App\Domain\Announcements\Jobs;

use App\Domain\Announcements\Notifications\AnnouncementPublished;
use App\Domain\Announcements\Services\AnnouncementTargets;
use App\Models\Announcement;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification;

/**
 * Notifies every recipient of a new announcement (except its author), in
 * chunks of 200 so a company-wide announcement never loads everyone at once.
 */
final class SendAnnouncementNotifications implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $announcementId) {}

    public function handle(AnnouncementTargets $targets): void
    {
        $announcement = Announcement::query()->with('author')->find($this->announcementId);

        if ($announcement === null || ! $announcement->isActive()) {
            return;
        }

        $targets->recipients($announcement)
            ->when($announcement->author_id !== null, fn ($query) => $query->whereKeyNot($announcement->author_id))
            ->chunkById(200, function (Collection $users) use ($announcement): void {
                Notification::send($users, new AnnouncementPublished($announcement));
            });
    }
}
