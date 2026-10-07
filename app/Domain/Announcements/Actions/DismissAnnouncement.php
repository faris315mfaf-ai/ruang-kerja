<?php

namespace App\Domain\Announcements\Actions;

use App\Models\Announcement;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * "×" on a dashboard banner: the announcement no longer shows on that
 * person's dashboards (idempotent). The Inbox notification is untouched.
 */
final class DismissAnnouncement
{
    public function handle(User $user, Announcement $announcement): void
    {
        DB::table('announcement_dismissals')->insertOrIgnore([
            'announcement_id' => $announcement->id,
            'user_id' => $user->id,
            'dismissed_at' => now(),
        ]);
    }
}
