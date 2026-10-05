<?php

namespace App\Domain\Notifications\Actions;

use App\Models\InboxNotification;

final class UnarchiveNotification
{
    public function handle(InboxNotification $notification): void
    {
        if ($notification->archived_at !== null) {
            $notification->forceFill(['archived_at' => null])->save();
        }
    }
}
