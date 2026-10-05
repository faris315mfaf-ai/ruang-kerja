<?php

namespace App\Domain\Notifications\Actions;

use App\Models\InboxNotification;
use Carbon\CarbonInterface;

/**
 * Retention ("Notifikasi disimpan 30 hari"): deletes notifications older than
 * notifications.retention_days, keeping unresolved "Perlu tindakan" items.
 */
final class PruneNotifications
{
    /**
     * @return int number of deleted notifications
     */
    public function handle(CarbonInterface $now): int
    {
        $cutoff = $now->copy()->subDays(config()->integer('notifications.retention_days', 30));

        return InboxNotification::query()
            ->where('created_at', '<', $cutoff)
            ->where(fn ($query) => $query
                ->where('action_required', false)
                ->orWhereNotNull('resolved_at'))
            ->delete();
    }
}
