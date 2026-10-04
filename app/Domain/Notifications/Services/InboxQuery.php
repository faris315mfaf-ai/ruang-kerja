<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Data\InboxFilters;
use App\Domain\Notifications\Enums\NotificationType;
use App\Models\InboxNotification;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * Inbox read model: filtered list and counters. Items are presented by
 * App\Http\Resources\InboxNotificationResource.
 */
final class InboxQuery
{
    public const int PER_PAGE = 30;

    /**
     * @return CursorPaginator<int, InboxNotification>
     */
    public function paginate(User $user, InboxFilters $filters): CursorPaginator
    {
        return $this->filtered($user, $filters)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->cursorPaginate(self::PER_PAGE);
    }

    /**
     * @return array{all: int, unread: int, action: int}
     */
    public function counts(User $user): array
    {
        return [
            'all' => InboxNotification::query()->visibleTo($user)->active()->count(),
            'unread' => $this->unreadCount($user),
            'action' => InboxNotification::query()->visibleTo($user)->needsAction()->count(),
        ];
    }

    public function unreadCount(User $user): int
    {
        return InboxNotification::query()->visibleTo($user)->active()->whereNull('read_at')->count();
    }

    /**
     * Newest active notifications created after $after (polling fallback).
     *
     * @return Collection<int, InboxNotification>
     */
    public function since(User $user, CarbonInterface $after, int $limit = 10): Collection
    {
        return InboxNotification::query()
            ->visibleTo($user)
            ->active()
            ->where('created_at', '>', $after)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();
    }

    /**
     * @return Builder<InboxNotification>
     */
    private function filtered(User $user, InboxFilters $filters): Builder
    {
        $query = InboxNotification::query()->visibleTo($user);

        $filters->archived ? $query->archived() : $query->active();

        match ($filters->tab) {
            'unread' => $query->whereNull('read_at'),
            'action' => $query->where('action_required', true)->whereNull('resolved_at'),
            default => null,
        };

        if ($filters->kind === InboxFilters::MENTION) {
            $query->ofType(NotificationType::Mention);
        } elseif (($category = $filters->category()) !== null) {
            $query->inCategory($category);
        }

        return $query;
    }
}
