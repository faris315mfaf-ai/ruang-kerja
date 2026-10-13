<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Data\InboxFilters;
use App\Domain\Notifications\Services\InboxQuery;
use App\Models\InboxNotification;
use App\Models\User;

/**
 * "Tandai semua dibaca": every unread, non-archived notification of the user.
 * The mobile app may narrow it to what a tab/kind filter shows ($scope);
 * the web always marks everything.
 */
final class MarkAllNotificationsRead
{
    /**
     * @return int number of notifications marked as read
     */
    public function handle(User $user, ?InboxFilters $scope = null): int
    {
        $query = $scope === null
            ? InboxNotification::query()->visibleTo($user)->active()
            : app(InboxQuery::class)->filtered($user, $scope);

        return $query
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);
    }
}
