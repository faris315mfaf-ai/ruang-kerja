<?php

namespace App\Domain\Search\Providers;

use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Domain\Search\Support\LikePattern;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Orang": colleagues by name or email.
 *
 * Visibility: company directory — every employee may find colleagues (PRD:
 * internal app, contact info is not secret). When the Organization module
 * defines a `visibleTo` scope on User it is applied automatically, so the
 * directory narrows without touching this provider. Only name, email and
 * avatar are exposed.
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

        $users = $this->visibleUsers($viewer)
            ->where(fn (Builder $q) => $q
                ->where('name', 'ilike', $pattern)
                ->orWhere('email', 'ilike', $pattern))
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'email']);

        $results = [];

        foreach ($users as $user) {
            $results[] = new SearchResult(
                id: 'user:'.$user->id,
                title: $user->name,
                icon: 'user',
                url: 'mailto:'.$user->email,
                subtitle: $user->email,
                external: true,
            );
        }

        return $results;
    }

    /**
     * @return Builder<User>
     */
    private function visibleUsers(User $viewer): Builder
    {
        $query = User::query();

        if ($query->getModel()->hasNamedScope('visibleTo')) {
            $query->scopes(['visibleTo' => [$viewer]]);
        }

        return $query;
    }
}
