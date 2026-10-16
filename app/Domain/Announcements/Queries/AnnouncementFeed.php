<?php

namespace App\Domain\Announcements\Queries;

use App\Domain\Announcements\Services\AnnouncementTargets;
use App\Models\Announcement;
use App\Models\Division;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Lists of announcements (resources/js/features/announcements/types.ts):
 * the dashboard banner (latest 3 active, received, not dismissed), what I
 * received and what I wrote (/pengumuman).
 */
final class AnnouncementFeed
{
    public const int BANNER = 3;

    /**
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function banner(User $user): array
    {
        $query = Announcement::query()->active()->receivedBy($user)->notDismissedBy($user);
        $total = (clone $query)->count();
        $items = $total === 0 ? new Collection : $query->with('author:id,name,avatar_url')
            ->orderByDesc('published_at')->orderByDesc('id')->limit(self::BANNER)->get();

        return ['items' => $this->present($items, $user), 'total' => $total];
    }

    /**
     * Received (active, newest first; dismissed ones included and marked).
     *
     * @return list<array<string, mixed>>
     */
    public function received(User $user, int $limit = 100): array
    {
        $items = Announcement::query()->active()->receivedBy($user)
            ->with('author:id,name,avatar_url')
            ->withExists(['dismissedBy as dismissed' => fn ($query) => $query->whereKey($user->id)])
            ->orderByDesc('published_at')->orderByDesc('id')->limit($limit)->get();

        return $this->present($items, $user);
    }

    /**
     * Received, paginated (mobile app): same rules as received() — active,
     * newest first, dismissed ones included and marked.
     *
     * @return LengthAwarePaginator<int, Announcement>
     */
    public function receivedPage(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return Announcement::query()->active()->receivedBy($user)
            ->with('author:id,name,avatar_url')
            ->withExists(['dismissedBy as dismissed' => fn ($query) => $query->whereKey($user->id)])
            ->orderByDesc('published_at')->orderByDesc('id')->paginate($perPage);
    }

    /**
     * Written by $user, paginated (expired included, newest first).
     *
     * @return LengthAwarePaginator<int, Announcement>
     */
    public function authoredPage(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return Announcement::query()->where('company_id', $user->company_id)->where('author_id', $user->id)
            ->with('author:id,name,avatar_url')
            ->orderByDesc('published_at')->orderByDesc('id')->paginate($perPage);
    }

    /**
     * Written by $user, expired included (newest first).
     *
     * @return list<array<string, mixed>>
     */
    public function authored(User $user, int $limit = 100): array
    {
        $items = Announcement::query()->where('company_id', $user->company_id)->where('author_id', $user->id)
            ->with('author:id,name,avatar_url')
            ->orderByDesc('published_at')->orderByDesc('id')->limit($limit)->get();

        return $this->present($items, $user);
    }

    /**
     * @param  Collection<int, Announcement>  $items
     * @return list<array<string, mixed>>
     */
    public function present(Collection $items, User $viewer): array
    {
        $ids = $items->flatMap(fn (Announcement $announcement): array => $announcement->target_ids)->unique()->values()->all();
        $names = $ids === [] ? [] : [
            ...Division::query()->whereIn('id', $ids)->pluck('name', 'id')->all(),
            ...Team::query()->whereIn('id', $ids)->pluck('name', 'id')->all(),
        ];
        $now = now()->toImmutable();

        return array_values($items->map(fn (Announcement $announcement): array => [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'body' => $announcement->body,
            'audience' => $announcement->audience->value,
            'audience_label' => AnnouncementTargets::label($announcement, $names),
            'author' => $announcement->author === null ? null : [
                'id' => $announcement->author->id,
                'name' => $announcement->author->name,
                'avatar' => $announcement->author->avatar_url,
            ],
            'published_at' => $announcement->published_at->toIso8601String(),
            'expires_at' => $announcement->expires_at?->toIso8601String(),
            'active' => $announcement->isActive($now),
            'dismissed' => (bool) ($announcement->getAttributes()['dismissed'] ?? false),
            'can_delete' => $announcement->author_id === $viewer->id,
        ])->all());
    }
}
