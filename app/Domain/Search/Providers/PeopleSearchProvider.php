<?php

namespace App\Domain\Search\Providers;

use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Support\LikePattern;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Orang": active colleagues by name or email, limited to User::visibleTo($viewer)
 * (company-scoped; everyone for employees.view, otherwise self + direct
 * reports + led divisions — docs/sprints/sprint-1/CORE.md §3). Exposes only
 * name, email, avatar, position and division.
 */
final class PeopleSearchProvider implements SearchProvider
{
    public function key(): string
    {
        return 'people';
    }

    public function label(): string
    {
        return 'Orang';
    }

    public function minQueryLength(): int
    {
        return 2;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        $pattern = LikePattern::contains($query);

        $users = User::query()
            ->visibleTo($viewer)
            ->active()
            ->where(fn (Builder $q) => $q
                ->where('users.name', 'ilike', $pattern)
                ->orWhere('users.email', 'ilike', $pattern))
            ->with(['division:id,name', 'position:id,name'])
            ->orderBy('users.name')
            ->limit($limit)
            ->get(['users.id', 'users.name', 'users.email', 'users.avatar_url', 'users.division_id', 'users.position_id']);

        $results = [];

        foreach ($users as $user) {
            $placement = array_filter([$user->position?->name, $user->division?->name]);

            $results[] = new SearchResult(
                id: 'user:'.$user->id,
                title: $user->name,
                icon: 'user',
                url: 'mailto:'.$user->email,
                subtitle: $placement !== [] ? implode(' · ', $placement) : $user->email,
                meta: $user->email,
                avatar: $user->avatar_url,
                external: true,
            );
        }

        return $results;
    }
}
